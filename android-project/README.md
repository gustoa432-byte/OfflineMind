# Offline Knowledge — Android APK Project

Готовый исходный код Android-приложения «Offline Knowledge» для сборки в Android Studio.

## Характеристики целевого устройства
- **Модель:** HONOR NIC-LX1
- **ОС:** Android 15 (MagicOS 9.0)
- **Процессор:** MediaTek Helio G81 Ultra (ARM64)
- **ОЗУ:** 6 ГБ LPDDR4X (без учета виртуальной RAM Turbo)
- **Хранилище:** 256 ГБ (доступно ~180 ГБ)

## Архитектура
1. **Язык и UI:** Kotlin + Jetpack Compose + Material 3.
2. **База данных:** SQLite через Android Jetpack Room (автономная работа < 50 мс без запуска LLM).
3. **Локальный инференс:** llama.cpp NDK/JNI (квантование GGUF Q4_K_M для Qwen2.5-1.5B и 0.5B).
4. **Загрузчик модели:** OkHttp с поддержкой Pause/Resume (HTTP Range headers), проверкой свободного места и валидацией контрольной суммы SHA-256.

## Инструкция по сборке APK в Android Studio
1. Откройте Android Studio (Hedgehog / Iguana / Jellyfish или новее).
2. Выберите **File -> Open...** и укажите данный каталог.
3. Убедитесь, что в SDK Manager установлены:
   - Android SDK 35 (Android 15)
   - NDK (версия 26.x или 27.x)
   - CMake 3.22.1+
4. Скачайте исходники llama.cpp в папку `app/src/main/cpp/llama.cpp`:
   \`git clone --depth 1 https://github.com/ggml-org/llama.cpp.git app/src/main/cpp/llama.cpp\`
5. Соберите APK:
   \`./gradlew assembleDebug\` или в меню **Build -> Build Bundle(s) / APK(s) -> Build APK(s)**.
6. Установите на HONOR NIC-LX1:
   \`adb install app/build/outputs/apk/debug/app-debug.apk\`
