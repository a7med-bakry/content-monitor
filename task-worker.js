require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const { chromium } = require("playwright");
const readline = require("node:readline/promises");
const { stdin, stdout } = require("node:process");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const rl = readline.createInterface({ input: stdin, output: stdout });
const POLL_MS = 5000;
const VIEWPORT = { width: 1920, height: 1080 };
let stopping = false;

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function updateTask(id, patch) {
  const { error } = await supabase.from("playwright_tasks").update(patch).eq("id", id);
  if (error) throw error;
}

async function claimNextTask() {
  const { data, error } = await supabase
    .from("playwright_tasks")
    .select("id,task_type,label,target_url,click_profile,click_x,click_y,repetitions,interval_minutes,status,result")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw error;
  const task = data && data[0];
  if (!task) return null;

  const { data: claimed, error: claimError } = await supabase
    .from("playwright_tasks")
    .update({ status: "running", started_at: new Date().toISOString(), error_message: null })
    .eq("id", task.id)
    .eq("status", "queued")
    .select("id,task_type,label,target_url,click_profile,click_x,click_y,repetitions,interval_minutes,status,result")
    .maybeSingle();
  if (claimError) throw claimError;
  return claimed || null;
}

function validateTask(task) {
  let u;
  try { u = new URL(task.target_url); } catch { throw new Error("Task URL is invalid."); }
  if (u.protocol !== "https:" || !u.hostname) throw new Error("Only valid HTTPS URLs are accepted.");
  if (!["click_1", "click_2", "click_3"].includes(task.click_profile)) throw new Error("Unknown click profile.");
  if (!Number.isInteger(task.click_x) || task.click_x < 0 || task.click_x >= VIEWPORT.width) {
    throw new Error("X must be between 0 and " + (VIEWPORT.width - 1) + " for the 1920px browser viewport.");
  }
  if (!Number.isInteger(task.click_y) || task.click_y < 0 || task.click_y >= VIEWPORT.height) {
    throw new Error("Y must be between 0 and " + (VIEWPORT.height - 1) + " for the 1080px browser viewport.");
  }
  if (!Number.isInteger(task.repetitions) || task.repetitions < 1 || task.repetitions > 1000) {
    throw new Error("Sessions/runs must be between 1 and 1000.");
  }
  if (!Number.isInteger(task.interval_minutes) || task.interval_minutes < 1 || task.interval_minutes > 1440) {
    throw new Error("Interval must be between 1 and 1440 minutes.");
  }
  return u;
}

async function processTask(task) {
  console.log("\n----------------------------------------");
  console.log("Task awaiting local approval");
  console.log("Label: " + task.label);
  console.log("URL: " + task.target_url);
  console.log("Profile: " + task.click_profile);
  console.log("Coordinates: X=" + task.click_x + ", Y=" + task.click_y);
  console.log("Runs: " + task.repetitions + " | Interval: " + task.interval_minutes + " minute(s)");
  console.log("Only approve if you trust this URL and intend to click this location.");
  const answer = (await rl.question('Type RUN to approve this task, or anything else to cancel: ')).trim();
  if (answer !== "RUN") {
    await updateTask(task.id, {
      status: "cancelled",
      completed_at: new Date().toISOString(),
      result: { execution: "cancelled_locally", reason: "Local operator did not approve the task." }
    });
    console.log("Task cancelled. No browser clicks were executed.");
    return;
  }

  let browser;
  const clickLog = [];
  try {
    const url = validateTask(task);
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: VIEWPORT });
    const page = await context.newPage();

    for (let run = 1; run <= task.repetitions; run++) {
      await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.mouse.click(task.click_x, task.click_y);
      clickLog.push({ run, clicked: true, x: task.click_x, y: task.click_y, at: new Date().toISOString(), finalUrl: page.url() });
      console.log("Run " + run + "/" + task.repetitions + ": clicked X=" + task.click_x + ", Y=" + task.click_y);
      if (run < task.repetitions) {
        console.log("Waiting " + task.interval_minutes + " minute(s) before next run...");
        await wait(task.interval_minutes * 60 * 1000);
      }
    }

    await updateTask(task.id, {
      status: "succeeded",
      completed_at: new Date().toISOString(),
      result: {
        execution: "approved_local_worker",
        click_profile: task.click_profile,
        viewport: VIEWPORT,
        requested_runs: task.repetitions,
        completed_runs: clickLog.length,
        clicks: clickLog
      }
    });
    console.log("Task succeeded: " + task.label);
  } catch (error) {
    try {
      await updateTask(task.id, {
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: String(error && error.message || error).slice(0, 2000),
        result: { execution: "approved_local_worker", completed_runs: clickLog.length, clicks: clickLog }
      });
    } catch (updateError) {
      console.error("Could not update failed task status:", updateError.message || updateError);
    }
    console.error("Task failed:", error.message || error);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

async function main() {
  console.log("Local Playwright task worker ready.");
  console.log("Browser clicks require typing RUN in this PowerShell window for each task.");
  console.log("Browser viewport is 1920x1080; X/Y are viewport coordinates, not physical screen coordinates.");
  console.log("Polling Supabase every " + (POLL_MS / 1000) + " seconds. Press Ctrl+C to stop.");

  process.on("SIGINT", () => {
    stopping = true;
    console.log("\nStopping after the current task finishes or is cancelled...");
  });

  while (!stopping) {
    try {
      const task = await claimNextTask();
      if (task) await processTask(task);
      else await wait(POLL_MS);
    } catch (error) {
      console.error("Worker polling error:", error.message || error);
      await wait(POLL_MS);
    }
  }
  rl.close();
  process.exit(0);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
