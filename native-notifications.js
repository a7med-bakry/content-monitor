import { Capacitor, registerPlugin } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

const native = Capacitor.isNativePlatform();
const ContentMonitorNotifications = registerPlugin("ContentMonitorNotifications");
window.contentMonitorNative = window.contentMonitorNative || {};

async function requestNativePermission() {
  const p = await PushNotifications.requestPermissions();
  return p.receive === "granted";
}

let listenersReady = false;
async function registerDeviceToken() {
  if (listenersReady) return;
  listenersReady = true;
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
  try {
    const granted = await requestNativePermission();
    if (!granted) {
      if (showError) alert("Notification permission was not granted. Enable notifications for Content Monitor in Android settings.");
      return false;
    }
    localStorage.setItem("nativeNotificationsEnabled", "1");
    await registerDeviceToken();
    await PushNotifications.register();
    return true;
  } catch (e) {
    console.error("Native notification setup failed", e);
    if (showError) alert("Could not enable notifications. Please try again.");
    return false;
  }
}

window.contentMonitorNative.testNotification = async () => {
  if (!native) return false;
  try {
    const ok = await setupNativeNotifications(true);
    if (!ok) return false;
    await ContentMonitorNotifications.notifyAlert({
      title: "Content Monitor",
      body: "Test notification is working."
    });
    return true;
  } catch (e) {
    console.error("Native test notification failed", e);
    return false;
  }
};

if (native) {
  window.Notification = class NativeNotification {
    static permission = localStorage.getItem("nativeNotificationsEnabled") === "1" ? "granted" : "default";
    static async requestPermission() {
      const ok = await setupNativeNotifications(true);
      NativeNotification.permission = ok ? "granted" : "denied";
      return NativeNotification.permission;
    }
    constructor(title, options = {}) {
      ContentMonitorNotifications.notifyAlert({
        title: String(title),
        body: String(options.body || "")
      }).catch((e) => console.error("Native notification failed", e));
    }
  };
  window.Notification.permission =
    localStorage.getItem("nativeNotificationsEnabled") === "1" ? "granted" : "default";
}
