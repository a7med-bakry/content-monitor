import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";

const native = Capacitor.isNativePlatform();

async function setupNativeNotifications() {
  if (!native) return false;
  try {
    const push = await PushNotifications.requestPermissions();
    if (push.receive !== "granted") {
      alert("Notification permission was not granted.");
      return false;
    }
    await LocalNotifications.requestPermissions();
    await PushNotifications.addListener("registration", async (token) => {
      localStorage.setItem("nativePushToken", token.value);
      try {
        await fetch("https://rwnesehhsblejmrbzzsu.supabase.co/functions/v1/reel-api", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({action:"register_push",token:token.value,platform:"android"})
        });
      } catch {}
    });
    await PushNotifications.addListener("registrationError", (error) => {
      console.error("Push registration error", error);
    });
    await PushNotifications.addListener("pushNotificationReceived", async (notification) => {
      try {
        await LocalNotifications.schedule({
          notifications: [{
            id: Math.floor(Date.now() % 2147483000),
            title: String(notification.title || "Content Monitor"),
            body: String(notification.body || ""),
            schedule: { at: new Date(Date.now() + 100) },
            channelId: "content_monitor_alerts",
            extra: notification.data || {}
          }]
        });
      } catch (error) {
        console.error("Foreground notification failed", error);
      }
    });
    await PushNotifications.register();
    localStorage.setItem("nativeNotificationsEnabled", "1");
    return true;
  } catch (error) {
    console.error("Native notification setup failed", error);
    alert("Could not enable notifications. Please try again.");
    return false;
  }
}

if (native) {
  window.Notification = class NativeNotification {
    static permission = localStorage.getItem("nativeNotificationsEnabled") === "1" ? "granted" : "default";

    static async requestPermission() {
      const ok = await setupNativeNotifications();
      NativeNotification.permission = ok ? "granted" : "denied";
      return NativeNotification.permission;
    }

    constructor(title, options = {}) {
      LocalNotifications.schedule({
        notifications: [{
          id: Math.floor(Date.now() % 2147483000),
          title: String(title),
          body: String(options.body || ""),
          schedule: { at: new Date(Date.now() + 100) },
          channelId: "content_monitor_alerts"
        }]
      }).catch((error) => console.error("Local notification failed", error));
    }
  };
  window.Notification.permission = localStorage.getItem("nativeNotificationsEnabled") === "1" ? "granted" : "default";
}
