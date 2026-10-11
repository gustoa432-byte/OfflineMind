# Add project specific ProGuard rules here.
-keepclasseswithmembernames class * {
    native <methods>;
}

-keep class com.offlineknowledge.app.engine.** { *; }
-keep class com.offlineknowledge.app.data.** { *; }
-keep class com.offlineknowledge.app.bridge.** { *; }
-keep class com.offlineknowledge.app.download.** { *; }
-keep class com.offlineknowledge.app.repository.** { *; }
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
