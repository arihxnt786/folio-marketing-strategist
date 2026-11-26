# Third-party components

| Component | Use | Version and license |
| --- | --- | --- |
| Papa Parse | CSV import, quoting, parsing and export | 5.5.3, MIT. Pinned official npm distribution, included in vendor with its notice. |
| wllama and its llama.cpp build | Browser CPU inference, grammar-constrained decoding, model management | @wllama/wllama 2.3.7, MIT. JS and single-thread WASM distributed from the upstream npm package. WASM is stored gzip-compressed. |
| Qwen2.5-0.5B-Instruct | Optional in-browser model | Apache-2.0. The first run fetches the Q4_K_M GGUF from bartowski's model repository, pinned at revision 41ba88dbac95fed2528c92514c131d73eb5a174b. Weights are not included in this repository. |
| SQLite | Local integration tests and local development | Node's built-in SQLite adapter. The hosted database is Cloudflare D1. |

Upstream links: [Papa Parse](https://github.com/mholt/PapaParse), [wllama](https://github.com/ngxson/wllama), [llama.cpp](https://github.com/ggml-org/llama.cpp), [Qwen model card](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct), [quantized model](https://huggingface.co/bartowski/Qwen2.5-0.5B-Instruct-GGUF). The build uses the Sites Worker ESM packaging convention. See RESEARCH.md for the evaluation of Postiz and its licence. No Postiz code is included.

The independent Cloudflare adapter uses [jose](https://github.com/panva/jose) 6.1.3 (MIT) for remote signing-key selection and JWT verification. It is an npm dependency of the optional standalone deployment.

Folio 2.0 uses fflate 0.8.3 (MIT) for Office archives. Its notice is in vendor/fflate-LICENSE. The installed pdfjs-dist 6.5.438 distribution is Apache-2.0; its license is included alongside the source notices. No model weights are included in the release.
