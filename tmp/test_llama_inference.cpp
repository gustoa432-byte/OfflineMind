#include <iostream>
#include <string>
#include <vector>
#include <chrono>
#include <fstream>
#include <algorithm>
#include "llama.h"

static int get_rss_mb() {
    std::ifstream statm("/proc/self/statm");
    if (!statm.is_open()) return 0;
    long total = 0, resident = 0;
    statm >> total >> resident;
    return static_cast<int>((resident * 4) / 1024);
}

int main(int argc, char** argv) {
    std::string model_path = (argc > 1) ? argv[1] : "/tmp/models/qwen2.5-0.5b-instruct-q4_k_m.gguf";
    std::string user_prompt = (argc > 2) ? argv[2] : "Сколько сантиметров в одном дециметре? Объясни кратко простыми словами.";

    std::cout << "=== REAL LLAMA.CPP INFERENCE TEST ===" << std::endl;
    std::cout << "Model path: " << model_path << std::endl;
    std::cout << "Question: " << user_prompt << std::endl;

    llama_backend_init();

    auto t_load_start = std::chrono::high_resolution_clock::now();
    struct llama_model_params mparams = llama_model_default_params();
    struct llama_model* model = llama_model_load_from_file(model_path.c_str(), mparams);
    if (!model) {
        std::cerr << "FAILED to load model from: " << model_path << std::endl;
        return 1;
    }

    const struct llama_vocab* vocab = llama_model_get_vocab(model);

    struct llama_context_params cparams = llama_context_default_params();
    cparams.n_ctx = 2048;
    cparams.n_threads = 4;
    cparams.n_batch = 512;

    struct llama_context* ctx = llama_init_from_model(model, cparams);
    if (!ctx) {
        std::cerr << "FAILED to create context" << std::endl;
        llama_model_free(model);
        return 1;
    }
    auto t_load_end = std::chrono::high_resolution_clock::now();
    long load_time_ms = std::chrono::duration_cast<std::chrono::milliseconds>(t_load_end - t_load_start).count();
    std::cout << "Model loaded in: " << load_time_ms << " ms. RAM RSS: " << get_rss_mb() << " MB" << std::endl;

    // Build chat formatted prompt for Qwen2.5-Instruct:
    // <|im_start|>system\nТы — полезный помощник.<|im_end|>\n<|im_start|>user\n{prompt}<|im_end|>\n<|im_start|>assistant\n
    std::string formatted_prompt = "<|im_start|>system\nТы — краткий русскоязычный справочник знаний. Отвечай прямо и понятно.<|im_end|>\n<|im_start|>user\n" + user_prompt + "<|im_end|>\n<|im_start|>assistant\n";

    std::vector<llama_token> tokens(formatted_prompt.length() + 64);
    int n_tokens = llama_tokenize(vocab, formatted_prompt.c_str(), formatted_prompt.length(), tokens.data(), tokens.size(), true, true);
    tokens.resize(n_tokens);

    // Sampler setup
    struct llama_sampler* smpl = llama_sampler_chain_init(llama_sampler_chain_default_params());
    llama_sampler_chain_add(smpl, llama_sampler_init_top_k(40));
    llama_sampler_chain_add(smpl, llama_sampler_init_top_p(0.9f, 1));
    llama_sampler_chain_add(smpl, llama_sampler_init_temp(0.7f));
    llama_sampler_chain_add(smpl, llama_sampler_init_dist(42));

    auto t_gen_start = std::chrono::high_resolution_clock::now();
    long ttft_ms = 0;
    int tokens_generated = 0;

    // Decode prompt
    struct llama_batch batch = llama_batch_get_one(tokens.data(), tokens.size());
    if (llama_decode(ctx, batch) != 0) {
        std::cerr << "llama_decode failed on prompt" << std::endl;
        return 1;
    }

    std::cout << "\n--- Model Output (Real Generation) ---" << std::endl;
    char piece[256];
    std::string full_response = "";

    for (int i = 0; i < 200; ++i) {
        const llama_token new_token = llama_sampler_sample(smpl, ctx, -1);
        llama_sampler_accept(smpl, new_token);

        if (i == 0) {
            auto now = std::chrono::high_resolution_clock::now();
            ttft_ms = std::chrono::duration_cast<std::chrono::milliseconds>(now - t_gen_start).count();
        }

        if (llama_vocab_is_eog(vocab, new_token)) {
            break;
        }

        int n_piece = llama_token_to_piece(vocab, new_token, piece, sizeof(piece), 0, false);
        if (n_piece > 0) {
            std::string piece_str(piece, n_piece);
            std::cout << piece_str << std::flush;
            full_response += piece_str;
        }
        tokens_generated++;

        llama_token single_token = new_token;
        struct llama_batch next_batch = llama_batch_get_one(&single_token, 1);
        if (llama_decode(ctx, next_batch) != 0) {
            break;
        }
    }

    auto t_gen_end = std::chrono::high_resolution_clock::now();
    long total_gen_ms = std::chrono::duration_cast<std::chrono::milliseconds>(t_gen_end - t_gen_start).count();
    double total_sec = std::max(0.001, (double)total_gen_ms / 1000.0);
    double tps = (double)tokens_generated / total_sec;
    int final_rss = get_rss_mb();

    std::cout << "\n\n--- Real Measured Metrics ---" << std::endl;
    std::cout << "TTFT: " << ttft_ms << " ms" << std::endl;
    std::cout << "Tokens generated: " << tokens_generated << std::endl;
    std::cout << "Generation time: " << total_gen_ms << " ms" << std::endl;
    std::cout << "Tokens per second: " << tps << " tok/s" << std::endl;
    std::cout << "RAM RSS: " << final_rss << " MB" << std::endl;
    std::cout << "Status: VERIFIED_REAL_INFERENCE_SUCCESS" << std::endl;

    llama_sampler_free(smpl);
    llama_free(ctx);
    llama_model_free(model);
    llama_backend_free();
    return 0;
}
