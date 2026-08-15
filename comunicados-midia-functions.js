// ============================================================
// COMUNICADOS COM MÍDIA — Green Park FC
// Adicionar ao final de functions/index.js
// ============================================================

function gpNoticeMediaType(value) {
  const type = safeContentString(value, 20).toLowerCase();
  return type === "image" || type === "video" ? type : "";
}

function gpNoticeStoragePath(value) {
  const path = safeContentString(value, 500);
  return path.startsWith("notices/") ? path : "";
}

exports.publicarComunicadoMidia = onCall(
    {
      region: "southamerica-east1",
      timeoutSeconds: 30,
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

      const mediaUrl =
        safeContentString(
            request.data?.mediaUrl,
            2000,
        );

      const mediaType =
        gpNoticeMediaType(
            request.data?.mediaType,
        );

      const storagePath =
        gpNoticeStoragePath(
            request.data?.storagePath,
        );

      const mimeType =
        safeContentString(
            request.data?.mimeType,
            120,
        );

      const fileName =
        safeContentString(
            request.data?.fileName,
            120,
        );

      const size =
        Math.max(
            0,
            Math.floor(
                Number(
                    request.data?.size,
                ) || 0,
            ),
        );

      if (
        mediaUrl &&
        !mediaType
      ) {
        throw new HttpsError(
            "invalid-argument",
            "Tipo de mídia inválido.",
        );
      }

      if (
        storagePath &&
        !mediaUrl
      ) {
        throw new HttpsError(
            "invalid-argument",
            "Mídia inválida.",
        );
      }

      const db = getFirestore();

      const ref =
        await db
            .collection("notices")
            .add({
              title,
              text,
              mediaUrl:
                mediaUrl || "",
              mediaType:
                mediaUrl ?
                  mediaType :
                  "",
              storagePath:
                mediaUrl ?
                  storagePath :
                  "",
              mimeType:
                mediaUrl ?
                  mimeType :
                  "",
              fileName:
                mediaUrl ?
                  fileName :
                  "",
              size:
                mediaUrl ?
                  size :
                  0,
              createdBy:
                request.auth.uid,
              createdAt:
                FieldValue.serverTimestamp(),
            });

      return {
        ok: true,
        id: ref.id,
      };
    },
);


exports.listarComunicadosMidia = onCall(
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
          const data =
            docSnap.data() || {};

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
            mediaUrl:
              safeContentString(
                  data.mediaUrl,
                  2000,
              ),
            mediaType:
              gpNoticeMediaType(
                  data.mediaType,
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


exports.excluirComunicadoMidia = onCall(
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

      const ref =
        db
            .collection("notices")
            .doc(id);

      const snapshot =
        await ref.get();

      if (!snapshot.exists) {
        return {ok: true};
      }

      const data =
        snapshot.data() || {};

      const storagePath =
        gpNoticeStoragePath(
            data.storagePath,
        );

      if (storagePath) {
        await deleteStoragePathIfExists(
            storagePath,
        );
      }

      await ref.delete();

      return {ok: true};
    },
);
