// app.config.js
import { defineConfig } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";
var app_config_default = defineConfig({
  vite: {
    plugins: [tailwindcss()],
    build: {
      target: ["es2020", "safari14"]
    }
  },
  server: {
    preset: "static",
    prerender: {
      routes: ["/", "/about", "/contact", "/privacy", "/resources", "/security", "/terms"],
      crawlLinks: true
    }
  }
});
export {
  app_config_default as default
};
