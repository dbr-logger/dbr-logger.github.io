if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

window.scrollTo(0, 0);
window.addEventListener("pageshow", () => {
  window.scrollTo(0, 0);
});

async function resolveBuildVersion() {
  const injectedBuildVersion = typeof window.__DBR_BUILD_VERSION__ === "string"
    ? window.__DBR_BUILD_VERSION__.trim()
    : "";
  if (injectedBuildVersion) {
    return injectedBuildVersion;
  }

  try {
    const response = await fetch(`./version.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) {
      return "";
    }

    const payload = await response.json();
    return typeof payload?.build === "string" && payload.build.trim()
      ? payload.build.trim()
      : "";
  } catch {
    return "";
  }
}

function updateStylesheet(buildVersion) {
  const stylesheet = document.querySelector("#app-stylesheet");
  if (!(stylesheet instanceof HTMLLinkElement)) {
    return;
  }

  stylesheet.href = buildVersion
    ? `./styles.css?v=${encodeURIComponent(buildVersion)}`
    : "./styles.css";
}

async function bootstrap() {
  const buildVersion = await resolveBuildVersion();
  updateStylesheet(buildVersion);
  const moduleVersion = buildVersion ? `?v=${encodeURIComponent(buildVersion)}` : "";

  const [{ createStore }, { createRenderer }] = await Promise.all([
    import(`./state/store.js${moduleVersion}`),
    import(`./ui/render.js${moduleVersion}`),
  ]);

  const store = createStore();
  const renderer = createRenderer(store);

  store.subscribe((snapshot) => {
    renderer.render(snapshot);
  });

  await store.initialize();
}

bootstrap();
