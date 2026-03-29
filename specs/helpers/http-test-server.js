async function withTestServer(app, fn) {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  async function request(pathname, options = {}) {
    const { body, headers = {}, ...rest } = options;
    const finalHeaders = { ...headers };
    let payload = body;

    if (body !== undefined && body !== null && !Buffer.isBuffer(body) && typeof body !== 'string') {
      finalHeaders['content-type'] = finalHeaders['content-type'] || 'application/json';
      payload = JSON.stringify(body);
    }

    const response = await fetch(`${baseUrl}${pathname}`, {
      ...rest,
      headers: finalHeaders,
      body: payload,
    });

    const text = await response.text();
    let json = null;

    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }

    return {
      status: response.status,
      text,
      json,
      headers: Object.fromEntries(response.headers.entries()),
    };
  }

  try {
    return await fn({ request, baseUrl });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

module.exports = { withTestServer };
