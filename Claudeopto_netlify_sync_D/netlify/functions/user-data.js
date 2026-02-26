// netlify/functions/user-data.js

export default async (request, context) => {
  // Helpers de resposta
  const json = (obj, status = 200, extraHeaders = {}) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...extraHeaders,
      },
    });

  const noContent = (status = 204, extraHeaders = {}) =>
    new Response(null, { status, headers: { ...extraHeaders } });

  try {
    // 1) Exigir login (Identity JWT)
    const user = context?.user;
    if (!user?.sub) {
      return json({ error: "Unauthorized" }, 401);
    }

    // 2) Importar Blobs (se você estiver usando Blobs)
    //    Obs: se isso falhar no deploy, o log vai mostrar "Cannot find package..."
    const { getStore } = await import("@netlify/blobs");
    const store = getStore("app-data");

    const key = `users/${user.sub}/data.json`;

    // 3) GET = puxar dados
    if (request.method === "GET") {
      const raw = await store.get(key, { type: "text" });
      if (!raw) {
        return json({ patients: [], updatedAt: 0, schemaVersion: 1 }, 200);
      }
      return new Response(raw, {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    // 4) POST = salvar dados
    if (request.method === "POST") {
      const bodyText = await request.text();
      if (!bodyText) return json({ error: "Empty body" }, 400);

      // valida JSON
      let parsed;
      try {
        parsed = JSON.parse(bodyText);
      } catch {
        return json({ error: "Invalid JSON" }, 400);
      }

      // garante campos mínimos
      const payload = {
        schemaVersion: parsed.schemaVersion ?? 1,
        updatedAt: parsed.updatedAt ?? Date.now(),
        patients: Array.isArray(parsed.patients) ? parsed.patients : [],
      };

      await store.set(key, JSON.stringify(payload));
      return json({ ok: true, updatedAt: payload.updatedAt }, 200);
    }

    // 5) Outros métodos
    return noContent(405, { Allow: "GET, POST" });
  } catch (err) {
    return json(
      {
        error: "Function crashed",
        message: err?.message ?? String(err),
      },
      500
    );
  }
};
// ===== NETLIFY IDENTITY UI FIX (Login/Logout/Sync) =====
(function () {
  function ni() {
    return window.netlifyIdentity;
  }

  function getUser() {
    try {
      return ni()?.currentUser?.() || null;
    } catch {
      return null;
    }
  }

  function setBoxLoggedIn(isLoggedIn) {
    // Ajuste os seletores abaixo se você usou outros IDs/classes
    const box = document.querySelector("#syncBox") || document.querySelector("[data-sync-box]");
    const btnLogin = document.querySelector("#btnLogin") || document.querySelector("[data-btn-login]");
    const btnLogout = document.querySelector("#btnLogout") || document.querySelector("[data-btn-logout]");
    const btnSync = document.querySelector("#btnSyncNow") || document.querySelector("[data-btn-sync]");

    // Se você não tiver IDs, isso evita quebrar
    if (btnLogin) btnLogin.style.display = isLoggedIn ? "none" : "inline-flex";
    if (btnSync) btnSync.style.display = isLoggedIn ? "inline-flex" : "none";
    if (btnLogout) btnLogout.style.display = isLoggedIn ? "inline-flex" : "none";

    // opcional: texto de status
    const status = document.querySelector("#syncStatus") || document.querySelector("[data-sync-status]");
    if (status) status.textContent = isLoggedIn ? "Logado — pronto para sincronizar" : "Faça login para sincronizar";
  }

  function wireButtons() {
    const btnLogin = document.querySelector("#btnLogin") || document.querySelector("[data-btn-login]");
    const btnLogout = document.querySelector("#btnLogout") || document.querySelector("[data-btn-logout]");

    if (btnLogin) {
      btnLogin.onclick = () => {
        ni()?.open?.("login");
      };
    }
    if (btnLogout) {
      btnLogout.onclick = async () => {
        await ni()?.logout?.();
      };
    }
  }

  function boot() {
    if (!ni()) {
      console.warn("Netlify Identity script não carregou (window.netlifyIdentity undefined).");
      return;
    }

    // init e eventos
    try {
      ni().init();
    } catch {}

    wireButtons();

    // Estado inicial
    setBoxLoggedIn(!!getUser());

    // Eventos (o que estava faltando em 80% dos casos)
    ni().on("init", (user) => setBoxLoggedIn(!!user));
    ni().on("login", (user) => setBoxLoggedIn(!!user));
    ni().on("logout", () => setBoxLoggedIn(false));
  }

  // Espera DOM + identity carregarem
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
