/*
 * GREEN PARK FC — Conteúdo V1
 * Galeria (foto/vídeo), Comunicados e Patrocinadores.
 *
 * ANEXAR AO FINAL de functions/index.js.
 *
 * Este arquivo usa:
 * - onCall, HttpsError, getFirestore, FieldValue
 *   já existentes no functions/index.js.
 * - Firebase Admin Storage importado abaixo com um nome exclusivo.
 */

const {
  getStorage: getAdminStorageGreenParkContent,
} = require("firebase-admin/storage");

const GREEN_PARK_ADMIN_UID_CONTENT =
  "d3nVt6SbQlO6lYnOcCUDbLBhoU02";


function contentAuthOrThrow(request) {
  if (!request.auth) {
    throw new HttpsError(
        "unauthenticated",
        "É necessário estar autenticado.",
    );
  }
}


function contentAdminOrThrow(request) {
  contentAuthOrThrow(request);

  if (
    request.auth.uid !==
    GREEN_PARK_ADMIN_UID_CONTENT
  ) {
    throw new HttpsError(
        "permission-denied",
        "Apenas o administrador pode fazer esta alteração.",
    );
  }
}


function safeContentString(value, maxLength) {
  return String(value || "")
      .trim()
      .slice(0, maxLength);
}


async function deleteStoragePathIfExists(path) {
  const cleanPath =
    safeContentString(path, 500);

  if (!cleanPath) return;

  try {
    const bucket =
      getAdminStorageGreenParkContent()
          .bucket();

    await bucket
        .file(cleanPath)
        .delete({ignoreNotFound: true});
  } catch (error) {
    console.warn(
        "Não foi possível remover arquivo Storage:",
        cleanPath,
        error.message,
    );
  }
}


// ============================================================
// GALERIA
// ============================================================

exports.salvarMidiaGaleria = onCall(
    {
      region: "southamerica-east1",
      timeoutSeconds: 20,
    },
    async (request) => {
      contentAdminOrThrow(request);

      const url =
        safeContentString(
            request.data?.url,
            2000,
        );

      const storagePath =
        safeContentString(
            request.data?.storagePath,
            500,
        );

      const type =
        safeContentString(
            request.data?.type,
            12,
        );

      const mimeType =
        safeContentString(
            request.data?.mimeType,
            120,
        );

      const caption =
        safeContentString(
            request.data?.caption,
            80,
        );

      const category =
        safeContentString(
            request.data?.category,
            30,
        ) || "Outros";

      const fileName =
        safeContentString(
            request.data?.fileName,
            120,
        );

      const size =
        Math.max(
            0,
            Number(request.data?.size) || 0,
        );

      if (!url || !storagePath) {
        throw new HttpsError(
            "invalid-argument",
            "Arquivo inválido.",
        );
      }

      if (
        type !== "image" &&
        type !== "video"
      ) {
        throw new HttpsError(
            "invalid-argument",
            "Tipo de mídia inválido.",
        );
      }

      if (
        !storagePath.startsWith("gallery/")
      ) {
        throw new HttpsError(
            "invalid-argument",
            "Caminho de mídia inválido.",
        );
      }

      const allowedCategories =
        new Set([
          "Futebol",
          "Resenha",
          "Churrasco",
          "Outros",
        ]);

      const finalCategory =
        allowedCategories.has(category) ?
          category :
          "Outros";

      const db = getFirestore();

      const ref =
        await db
            .collection("gallery")
            .add({
              url,
              storagePath,
              type,
              mimeType,
              caption,
              category: finalCategory,
              fileName,
              size,
              createdBy: request.auth.uid,
              createdAt:
                FieldValue.serverTimestamp(),
            });

      return {
        ok: true,
        id: ref.id,
      };
    },
);


exports.listarGaleria = onCall(
    {
      region: "southamerica-east1",
      timeoutSeconds: 20,
    },
    async (request) => {
      contentAuthOrThrow(request);

      const db = getFirestore();

      const snapshot =
        await db
            .collection("gallery")
            .get();

      const items =
        snapshot.docs.map((docSnap) => {
          const data = docSnap.data() || {};

          let createdAt = 0;

          if (
            data.createdAt &&
            typeof data.createdAt.toMillis ===
              "function"
          ) {
            createdAt =
              data.createdAt.toMillis();
          }

          return {
            id: docSnap.id,
            url:
              safeContentString(
                  data.url,
                  2000,
              ),
            storagePath:
              safeContentString(
                  data.storagePath,
                  500,
              ),
            type:
              data.type === "video" ?
                "video" :
                "image",
            caption:
              safeContentString(
                  data.caption,
                  80,
              ),
            category:
              safeContentString(
                  data.category,
                  30,
              ) || "Outros",
            createdAt,
          };
        })
            .filter((item) => item.url)
            .sort(
                (a, b) =>
                  b.createdAt -
                  a.createdAt,
            )
            .slice(0, 300);

      return {items};
    },
);


exports.excluirMidiaGaleria = onCall(
    {
      region: "southamerica-east1",
      timeoutSeconds: 20,
    },
    async (request) => {
      contentAdminOrThrow(request);

      const id =
        safeContentString(
            request.data?.id,
            160,
        );

      if (!id) {
        throw new HttpsError(
            "invalid-argument",
            "Mídia inválida.",
        );
      }

      const db = getFirestore();

      const ref =
        db.collection("gallery").doc(id);

      const snapshot =
        await ref.get();

      if (!snapshot.exists) {
        return {ok: true};
      }

      const data = snapshot.data() || {};

      await deleteStoragePathIfExists(
          data.storagePath,
      );

      await ref.delete();

      return {ok: true};
    },
);


// ============================================================
// COMUNICADOS
// ============================================================

exports.publicarComunicado = onCall(
    {
      region: "southamerica-east1",
      timeoutSeconds: 20,
    },
    async (request) => {
      contentAdminOrThrow(request);

      const title =
        safeContentString(
            request.data?.title,
            80,
        );

      const text =
        safeContentString(
            request.data?.text,
            1200,
        );

      if (
        title.length < 3 ||
        text.length < 3
      ) {
        throw new HttpsError(
            "invalid-argument",
            "Título e texto são obrigatórios.",
        );
      }

      const db = getFirestore();

      const ref =
        await db
            .collection("notices")
            .add({
              title,
              text,
              createdBy: request.auth.uid,
              createdAt:
                FieldValue.serverTimestamp(),
            });

      return {
        ok: true,
        id: ref.id,
      };
    },
);


exports.listarComunicados = onCall(
    {
      region: "southamerica-east1",
      timeoutSeconds: 20,
    },
    async (request) => {
      contentAuthOrThrow(request);

      const db = getFirestore();

      const snapshot =
        await db
            .collection("notices")
            .get();

      const items =
        snapshot.docs.map((docSnap) => {
          const data = docSnap.data() || {};

          let createdAt = 0;

          if (
            data.createdAt &&
            typeof data.createdAt.toMillis ===
              "function"
          ) {
            createdAt =
              data.createdAt.toMillis();
          }

          return {
            id: docSnap.id,
            title:
              safeContentString(
                  data.title,
                  80,
              ),
            text:
              safeContentString(
                  data.text,
                  1200,
              ),
            createdAt,
          };
        })
            .sort(
                (a, b) =>
                  b.createdAt -
                  a.createdAt,
            )
            .slice(0, 100);

      return {items};
    },
);


exports.excluirComunicado = onCall(
    {
      region: "southamerica-east1",
      timeoutSeconds: 20,
    },
    async (request) => {
      contentAdminOrThrow(request);

      const id =
        safeContentString(
            request.data?.id,
            160,
        );

      if (!id) {
        throw new HttpsError(
            "invalid-argument",
            "Comunicado inválido.",
        );
      }

      const db = getFirestore();

      await db
          .collection("notices")
          .doc(id)
          .delete();

      return {ok: true};
    },
);


// ============================================================
// PATROCINADORES
// ============================================================

exports.salvarPatrocinador = onCall(
    {
      region: "southamerica-east1",
      timeoutSeconds: 20,
    },
    async (request) => {
      contentAdminOrThrow(request);

      const slot =
        Math.floor(
            Number(request.data?.slot) || 0,
        );

      const url =
        safeContentString(
            request.data?.url,
            2000,
        );

      const storagePath =
        safeContentString(
            request.data?.storagePath,
            500,
        );

      const fileName =
        safeContentString(
            request.data?.fileName,
            120,
        );

      if (
        slot < 1 ||
        slot > 9 ||
        !url ||
        !storagePath
      ) {
        throw new HttpsError(
            "invalid-argument",
            "Patrocinador inválido.",
        );
      }

      const expectedPrefix =
        "sponsors/slot-" +
        String(slot).padStart(2, "0") +
        "/";

      if (
        !storagePath.startsWith(
            expectedPrefix,
        )
      ) {
        throw new HttpsError(
            "invalid-argument",
            "Caminho da logo inválido.",
        );
      }

      const db = getFirestore();

      const docId =
        "slot-" +
        String(slot).padStart(2, "0");

      const ref =
        db
            .collection("sponsors")
            .doc(docId);

      const previous =
        await ref.get();

      const oldPath =
        previous.exists ?
          previous.data()?.storagePath :
          "";

      await ref.set(
          {
            slot,
            url,
            storagePath,
            fileName,
            updatedBy:
              request.auth.uid,
            updatedAt:
              FieldValue.serverTimestamp(),
          },
          {merge: false},
      );

      if (
        oldPath &&
        oldPath !== storagePath
      ) {
        await deleteStoragePathIfExists(
            oldPath,
        );
      }

      return {ok: true};
    },
);


exports.listarPatrocinadores = onCall(
    {
      region: "southamerica-east1",
      timeoutSeconds: 20,
    },
    async (request) => {
      contentAuthOrThrow(request);

      const db = getFirestore();

      const snapshot =
        await db
            .collection("sponsors")
            .get();

      const items =
        snapshot.docs.map((docSnap) => {
          const data = docSnap.data() || {};

          return {
            slot:
              Math.floor(
                  Number(data.slot) || 0,
              ),
            url:
              safeContentString(
                  data.url,
                  2000,
              ),
          };
        })
            .filter(
                (item) =>
                  item.slot >= 1 &&
                  item.slot <= 9 &&
                  item.url,
            )
            .sort(
                (a, b) =>
                  a.slot - b.slot,
            );

      return {items};
    },
);


exports.removerPatrocinador = onCall(
    {
      region: "southamerica-east1",
      timeoutSeconds: 20,
    },
    async (request) => {
      contentAdminOrThrow(request);

      const slot =
        Math.floor(
            Number(request.data?.slot) || 0,
        );

      if (
        slot < 1 ||
        slot > 9
      ) {
        throw new HttpsError(
            "invalid-argument",
            "Espaço inválido.",
        );
      }

      const db = getFirestore();

      const docId =
        "slot-" +
        String(slot).padStart(2, "0");

      const ref =
        db
            .collection("sponsors")
            .doc(docId);

      const snapshot =
        await ref.get();

      if (snapshot.exists) {
        await deleteStoragePathIfExists(
            snapshot.data()?.storagePath,
        );

        await ref.delete();
      }

      return {ok: true};
    },
);
