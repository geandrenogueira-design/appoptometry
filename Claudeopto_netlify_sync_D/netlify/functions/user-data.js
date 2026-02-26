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
