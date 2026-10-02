import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";
import { registerPlugin } from "@capacitor/core";
const ContentMonitorNotifications = registerPlugin("ContentMonitorNotifications");

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
    await PushNotifications.addListener("registration", (token) => {
      localStorage.setItem("nativePushToken", token.value);
      fetch("https://rwnesehhsblejmrbzzsu.supabase.co/functions/v1/reel-api",{method:"POST",headers:{"Content-Type":"text/plain"},body:JSON.stringify({action:"register_push",token:token.value,platform:"android"})}).catch(()=>{});
    });
    await PushNotifications.addListener("registrationError", (error) => {
      console.error("Push registration error", error);
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
          channelId: "content_monitor_alerts", sound: "alert_siren"
        }]
      }).catch((error) => console.error("Local notification failed", error));
    }
  };
  window.Notification.permission = localStorage.getItem("nativeNotificationsEnabled") === "1" ? "granted" : "default";
}

window.contentMonitorNative = window.contentMonitorNative || {};
window.contentMonitorNative.chooseAlertSound = async()=>ContentMonitorNotifications.pickNotificationSound();
window.contentMonitorNative.getAlertSound = async()=>ContentMonitorNotifications.getNotificationSound();
window.contentMonitorNative.notify = async(title,body)=>ContentMonitorNotifications.notifyAlert({title,body});
