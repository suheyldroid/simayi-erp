# Test politikası

- Bu projede **asla ve asla test yapılmayacak**.
- Test dosyası yazma, oluşturma veya silinen testleri geri ekleme.
- Birim, entegrasyon, E2E, smoke ve tarayıcı testleri dahil hiçbir otomatik veya manuel test çalıştırma.
- Test komutu, test senaryosu veya test altyapısı ekleme.
- Bu kural tüm modüller ve sonraki çalışmalar için geçerlidir.

# Backend modül mimarisi

Backend modülü yazmadan veya düzenlemeden önce `.agents/skills/structure-modules/SKILL.md` dosyasını oku ve uygula.

- Modülleri `apps/api/src/modules/<modül>/` altında tut.
- **Auth istisnadır:** Mevcut Better Auth/Elysia entegrasyonuna ve `apps/api/src/modules/auth/` dosyalarına dokunma; Auth için ek servis katmanı oluşturma.
- `controller.ts`: Controller doğrudan bir **Elysia instance'ı** olmalıdır. Route, HTTP doğrulaması, header/cookie ve HTTP durum kodlarını burada yönet.
- `service.ts`: Servisleri **statik sınıflar ve statik metotlar** olarak yaz. Durum tutmayan servisler için `abstract class` kullan. Servis instance'ı oluşturma.
- İş mantığını ve veri/harici servis işlemlerini servis katmanına koy. Elysia `Context` nesnesinin tamamını servise geçirme; yalnızca gereken değerleri aktar.
- `model.ts`: DTO şemalarını ve TypeScript tiplerini burada tanımla. Şemalarda `elysia` paketinin `t` nesnesini kullan. DTO tiplerini `UnwrapSchema` veya `.static` üzerinden türet; aynı sözleşmeyi ayrıca interface ile tekrarlama.
- Alt modülleri ana modülün altında `<modül>/<alt-modül>/` olarak tut. Aynı `controller.ts`, `service.ts`, `model.ts` ayrımını uygula.
- Alt modül controller'larını ana modül controller'ı `.use(...)` ile consume etmelidir. `app.ts` yalnızca ana modül controller'larını bağlar; alt modülleri doğrudan bağlamaz.
- İstek bağımlı Elysia plugin/macro'larını ince adaptör olarak tut; iş mantığını statik servis metotlarına devret.
- Better Auth gibi kütüphanelerin yerleşik API'lerini kullan. Bu katman ayrımı için kimlik doğrulama, parola veya oturum mantığını yeniden yazma.
- `lib/` ve `plugins/` ortak altyapıdır; bunları gereksiz modüllere veya servis sınıflarına dönüştürme.

Kaynak: https://elysiajs.com/essential/best-practice.html

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
