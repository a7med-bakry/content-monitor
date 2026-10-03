import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";

const native = Capacitor.isNativePlatform();
window.contentMonitorNative = window.contentMonitorNative || {};
const CHANNEL_ID = "content_monitor_alerts";
let pushListenersReady = false;
let localChannelReady = false;

async function ensureLocalNotifications() {
  if (!native) return false;
  try {
    const p = await LocalNotifications.requestPermissions();
    if (p.display !== "granted") return false;
    if (!localChannelReady) {
      await LocalNotifications.createChannel({
        id: CHANNEL_ID,
        name: "Content Monitor alerts",
        description: "Alerts from Content Monitor",
        importance: 5,
        visibility: 1,
        sound: "default",
        vibration: true
      }).catch(() => {});
      localChannelReady = true;
    }
    return true;
  } catch (e) {
    console.error("Local notification setup failed", e);
    return false;
  }
}

async function registerDeviceToken() {
  if (pushListenersReady) return;
  pushListenersReady = true;
  try {
    await PushNotifications.addListener("registration", async (token) => {
      const value = String(token?.value || "").trim();
      if (!value) return;
      localStorage.setItem("nativePushToken", value);
      try {
        const r = await fetch("https://rwnesehhsblejmrbzzsu.supabase.co/functions/v1/reel-api", {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({action:"register_push", token:value, platform:"android"})
        });
        if (!r.ok) console.error("Push token API rejected:", await r.text());
      } catch (e) {
        console.error("Push token registration failed", e);
      }
    });
    await PushNotifications.addListener("registrationError", (error) => {
      console.error("FCM registration error", error);
    });
    await PushNotifications.addListener("pushNotificationReceived", (notification) => {
      console.log("FCM notification received", notification);
    });
  } catch (e) {
    console.error("Push listener setup failed", e);
  }
}

async function setupNativeNotifications(showError = true) {
  if (!native) return false;
  const localOk = await ensureLocalNotifications();
  if (!localOk) {
    if (showError) alert("Android notification permission is off. Open Settings → Apps → Content Monitor → Notifications and enable it.");
    return false;
  }
  await registerDeviceToken();
  try {
    const p = await PushNotifications.requestPermissions();
    if (p.receive === "granted") await PushNotifications.register();
  } catch (e) {
    console.error("FCM setup failed", e);
  }
  localStorage.setItem("nativeNotificationsEnabled", "1");
  return true;
}

window.contentMonitorNative.testNotification = async () => {
  if (!native) return false;
  const ok = await setupNativeNotifications(true);
  if (!ok) return false;
  const id = Math.floor(Date.now() % 2147483000);
  await LocalNotifications.schedule({
    notifications: [{
      id,
      title: "Content Monitor",
      body: "Test notification is working.",
      channelId: CHANNEL_ID,
      schedule: { at: new Date(Date.now() + 1500), allowWhileIdle: true },
      autoCancel: true
    }]
  });
  return true;
};

if (native) {
  // Register FCM as soon as the app starts, not only after pressing Test Notification.
  // This keeps the device token registered so FCM can wake the app while it is fully closed.
  setupNativeNotifications(false).catch(e => console.error("Background push registration failed", e));
  document.addEventListener("resume", () => {
    setupNativeNotifications(false).catch(e => console.error("Push re-registration failed", e));
  });
  window.Notification = class NativeNotification {
    static permission = localStorage.getItem("nativeNotificationsEnabled") === "1" ? "granted" : "default";
    static async requestPermission() {
      const ok = await setupNativeNotifications(true);
      NativeNotification.permission = ok ? "granted" : "denied";
      return NativeNotification.permission;
    }
    constructor(title, options = {}) {
      LocalNotifications.schedule({
        notifications: [{
          id: Math.floor(Date.now() % 2147483000),
          title: String(title),
          body: String(options.body || ""),
          channelId: CHANNEL_ID,
          schedule: { at: new Date(Date.now() + 500), allowWhileIdle: true },
          autoCancel: true
        }]
      }).catch(e => console.error("Native notification failed", e));
    }
  };
  window.Notification.permission =
    localStorage.getItem("nativeNotificationsEnabled") === "1" ? "granted" : "default";
}
