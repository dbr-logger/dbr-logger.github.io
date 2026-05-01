const FALLBACK_BUILD_VERSION = "20260430-4";

async function resolveBuildVersion() {
  try {
    const response = await fetch(`./version.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) {
      return FALLBACK_BUILD_VERSION;
    }

    const payload = await response.json();
    return typeof payload?.build === "string" && payload.build.trim()
      ? payload.build.trim()
      : FALLBACK_BUILD_VERSION;
  } catch {
    return FALLBACK_BUILD_VERSION;
  }
}

function updateStylesheet(buildVersion) {
  const stylesheet = document.querySelector("#app-stylesheet");
  if (!(stylesheet instanceof HTMLLinkElement)) {
    return;
  }

  stylesheet.href = `./styles.css?v=${encodeURIComponent(buildVersion)}`;
}

async function bootstrap() {
  const buildVersion = await resolveBuildVersion();
  updateStylesheet(buildVersion);

  const [{ createStore }, { createRenderer }] = await Promise.all([
    import(`./state/store.js?v=${encodeURIComponent(buildVersion)}`),
    import(`./ui/render.js?v=${encodeURIComponent(buildVersion)}`),
  ]);

  const store = createStore();
  const renderer = createRenderer(store);

  store.subscribe((snapshot) => {
    renderer.render(snapshot);
  });

  await store.initialize();
}

bootstrap();
