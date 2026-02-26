// netlify/functions/user-data.mjs
export default async (request, context) => {
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });

  try {
    const user = context?.user;
    if (!user?.sub) return json({ error: "Unauthorized" }, 401);

    const { getStore } = await import("@netlify/blobs");
    const store = getStore("app-data");
    const key = `users/${user.sub}/data.json`;

    if (request.method === "GET") {
      const raw = await store.get(key, { type: "text" });
      if (!raw) return json({ patients: [], updatedAt: 0, schemaVersion: 1 }, 200);
      return new Response(raw, {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    if (request.method === "POST") {
      const bodyText = await request.text();
      if (!bodyText) return json({ error: "Empty body" }, 400);

      let parsed;
      try { parsed = JSON.parse(bodyText); }
      catch { return json({ error: "Invalid JSON" }, 400); }

      const payload = {
        schemaVersion: parsed.schemaVersion ?? 1,
        updatedAt: parsed.updatedAt ?? Date.now(),
        patients: Array.isArray(parsed.patients) ? parsed.patients : [],
      };

      await store.set(key, JSON.stringify(payload));
      return json({ ok: true, updatedAt: payload.updatedAt }, 200);
    }

    return new Response(null, { status: 405, headers: { Allow: "GET, POST" } });
  } catch (err) {
    return json(
      { error: "Function crashed", message: err?.message ?? String(err) },
      500
    );
  }
};
