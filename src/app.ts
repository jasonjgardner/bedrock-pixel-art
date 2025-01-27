import { Alignment, PackSizes } from "./types.d.ts";
import {
  ART_SOURCE_ID,
  CHUNK_SIZE,
  DEFAULT_MATERIAL_ID,
  DEFAULT_NAMESPACE,
  DEFAULT_PACK_SIZE,
  DEFAULT_SLICE_SIZE,
} from "./constants.ts";
import { Application, Router } from "oak/mod.ts";
//import { getNearestPackSize } from "./components/_resize.ts";
import download from "./controllers/download.ts";

const router = new Router();

router
  .get("/", async (context) => {
    const root = `${Deno.cwd()}/dist`;
    await context.send({
      path: "index.html",
      root,
    });
  })
  .get("/download", async (context, next) => {
    const blob = await download({
      size: DEFAULT_PACK_SIZE,
      namespace: DEFAULT_NAMESPACE,
    }, DEFAULT_MATERIAL_ID);

    context.response.status = 200;
    context.response.headers.set(
      "content-disposition",
      'attachment; filename="generated.mcaddon"',
    );
    context.response.type = "application/octet-stream";
    context.response.body = new Uint8Array(await blob.arrayBuffer());

    return next();
  })
  .post(
    "/download",
    async (context, _next) => {
      const body = context.request.body({ type: "form-data" });
      const data = await body.value.read();

      if (data.fields) {
        const namespace = data.fields.namespace ?? DEFAULT_NAMESPACE;
        const blob = await download({
          size: <PackSizes> parseInt(
            data.fields.size ?? `${DEFAULT_PACK_SIZE}`,
            10,
          ) || DEFAULT_PACK_SIZE,

          pixelArtSource: data.fields.img,
          pixelArtSourceName: data.fields.img_name ?? ART_SOURCE_ID,
          merSource: data.fields.mer,
          normalSource: data.fields.normal,
          namespace,
          description: data.fields.description ?? "Generated pixel art palette",
          animationAlignment: <Alignment> data.fields.alignment ?? "e2e",
          // FIXME: Slices count interferes with size parameter
          slices: {
            sliceCount: parseInt(data.fields.slice_count ?? "1", 10),
            canvasSize: parseInt(data.fields.slices, 10) || DEFAULT_SLICE_SIZE,
            textureSize: <PackSizes> parseInt(
              data.fields.size ?? `${DEFAULT_PACK_SIZE}`,
              10,
            ) || DEFAULT_PACK_SIZE,
          },
        }, data.fields.materials ?? DEFAULT_MATERIAL_ID);

        const responseData = new Uint8Array(await blob.arrayBuffer());

        context.response.status = 200;
        context.response.headers.set(
          "content-disposition",
          `attachment; filename="${namespace}.mcaddon"`,
        );
        context.response.type = "application/octet-stream";
        context.response.body = responseData;

        // TODO: Cache responseData or store locally
      }
    },
  );

const app = new Application();

app.use(router.routes());
app.use(router.allowedMethods());

app.use(async function useStaticDirectoryRoute(context, next) {
  const root = `${Deno.cwd()}/dist`;
  try {
    await context.send({ root });
  } catch {
    return next();
  }
});

app.use(function usePageNotFoundRoute(context) {
  context.response.status = 404;
  context.response.body = `"${context.request.url}" not found`;
});

app.addEventListener("listen", () => {
  console.log("🌈 http://localhost:8000 🪄🎨");
});

await app.listen({ port: 8000 });
