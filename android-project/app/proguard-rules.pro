# Add project specific ProGuard rules here.
-keepclasseswithmembernames class * {
    native <methods>;
}

-keep class com.offlineknowledge.app.engine.** { *; }
-keep class com.offlineknowledge.app.data.** { *; }
