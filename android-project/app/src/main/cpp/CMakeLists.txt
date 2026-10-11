cmake_minimum_required(VERSION 3.22.1)
project(offline_knowledge_llama)

set(CMAKE_CXX_STANDARD 17)

# Настройки для сборки компактной мобильной библиотеки llama.cpp
set(LLAMA_BUILD_EXAMPLES OFF CACHE BOOL "Do not build examples" FORCE)
set(LLAMA_BUILD_TESTS OFF CACHE BOOL "Do not build tests" FORCE)
set(LLAMA_BUILD_TOOLS OFF CACHE BOOL "Do not build tools" FORCE)
set(LLAMA_BUILD_SERVER OFF CACHE BOOL "Do not build server" FORCE)
set(LLAMA_BUILD_COMMON ON CACHE BOOL "Build common library" FORCE)
set(BUILD_SHARED_LIBS OFF CACHE BOOL "Build static libraries" FORCE)

# Добавляем исходники llama.cpp и GGML
add_subdirectory(llama.cpp)

# Наша JNI библиотека-мост
add_library(llama-jni SHARED
    llama_bridge.cpp
)

target_include_directories(llama-jni PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/llama.cpp/include
    ${CMAKE_CURRENT_SOURCE_DIR}/llama.cpp/common
)

# Линкуем llama, ggml и системные библиотеки Android
target_link_libraries(llama-jni
    PRIVATE
    llama
    ggml
    android
    log
)
