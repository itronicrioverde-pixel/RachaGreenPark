/*
 * GREEN PARK FC — CONFIRMADOS UNIFICADOS
 *
 * REGRA PRINCIPAL:
 * players/{uid}.status == "confirmed"
 *
 * Quem está confirmado aparece automaticamente em:
 * 1. Lista
 * 2. Ranking
 * 3. Estatísticas do racha
 *
 * Anexar ao FINAL de functions/index.js.
 */

const GREEN_PARK_ADMIN_UID_UNIFIED =
  "d3nVt6SbQlO6lYnOcCUDbLBhoU02";


function unifiedAuthOrThrow(request) {
  if (!request.auth) {
    throw new HttpsError(
        "unauthenticated",
        "É necessário estar autenticado.",
    );
  }
}


function unifiedAdminOrThrow(request) {
  unifiedAuthOrThrow(request);

  if (
    request.auth.uid !==
    GREEN_PARK_ADMIN_UID_UNIFIED
  ) {
    throw new HttpsError(
        "permission-denied",
        "Apenas o administrador pode alterar as estatísticas.",
    );
  }
}


function unifiedSafeName(value) {
  return String(value || "Jogador")
      .trim()
      .slice(0, 60);
}


function unifiedSafeMatchKey(value) {
  return String(value || "")
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 90);
}


function unifiedStatDocId(
    matchKey,
    playerId,
) {
  return (
    matchKey +
    "__" +
    String(playerId || "")
        .replace(/[^a-zA-Z0-9_-]/g, "")
        .slice(0, 128)
  );
}


async function unifiedConfirmedPlayers(db) {
  const snapshot =
    await db
        .collection("players")
        .where(
            "status",
            "==",
            "confirmed",
        )
        .get();

  const players =
    snapshot.docs.map((docSnap) => {
      const data =
        docSnap.data() || {};

      let confirmedAt = 0;

      if (
        data.confirmedAt &&
        typeof data.confirmedAt.toMillis ===
          "function"
      ) {
        confirmedAt =
          data.confirmedAt.toMillis();
      }

      return {
        id: docSnap.id,
        name:
          unifiedSafeName(
              data.name,
          ),
        photoURL:
          String(
              data.photoURL || "",
          ).slice(0, 2000),
        confirmedAt,
      };
    });

  players.sort((a, b) => {
    if (
      a.confirmedAt &&
      b.confirmedAt
    ) {
      return (
        a.confirmedAt -
        b.confirmedAt
      );
    }

    return a.name.localeCompare(
        b.name,
        "pt-BR",
    );
  });

  return players;
}


async function unifiedGetConfirmedPlayerOrThrow(
    db,
    playerId,
) {
  const snapshot =
    await db
        .collection("players")
        .doc(playerId)
        .get();

  if (!snapshot.exists) {
    throw new HttpsError(
        "not-found",
        "Jogador não encontrado.",
    );
  }

  const data =
    snapshot.data() || {};

  if (
    data.status !==
    "confirmed"
  ) {
    throw new HttpsError(
        "failed-precondition",
        "Esse jogador não está confirmado.",
    );
  }

  return data;
}


async function unifiedRecomputeRanking(db) {
  /*
   * Importante:
   * começamos pelos CONFIRMADOS.
   * Portanto jogador com 0 gols também aparece.
   */
  const confirmed =
    await unifiedConfirmedPlayers(db);

  const map = new Map();

  confirmed.forEach((player) => {
    map.set(player.id, {
      playerId: player.id,
      name: player.name,
      photoURL:
        player.photoURL || "",
      goals: 0,
      goalkeeperGames: 0,
      goalsConceded: 0,
    });
  });

  const statsSnapshot =
    await db
        .collection("match_stats")
        .get();

  statsSnapshot.docs.forEach(
      (docSnap) => {
        const stat =
          docSnap.data() || {};

        const playerId =
          String(
              stat.playerId || "",
          ).trim();

        /*
         * Se não está mais confirmado,
         * não aparece no ranking atual.
         */
        if (
          !playerId ||
          !map.has(playerId)
        ) {
          return;
        }

        const player =
          map.get(playerId);

        player.goals +=
          Math.max(
              0,
              Math.floor(
                  Number(
                      stat.goals,
                  ) || 0,
              ),
          );

        if (
          stat.isGoalkeeper ===
          true
        ) {
          player.goalkeeperGames += 1;

          player.goalsConceded +=
            Math.max(
                0,
                Math.floor(
                    Number(
                        stat.goalsConceded,
                    ) || 0,
                ),
            );
        }
      },
  );

  const all =
    Array.from(
        map.values(),
    );

  /*
   * ARtilharia:
   * TODOS os confirmados aparecem,
   * inclusive com 0 gols.
   */
  const scorers =
    all
        .sort((a, b) => {
          if (
            b.goals !== a.goals
          ) {
            return (
              b.goals -
              a.goals
            );
          }

          return a.name.localeCompare(
              b.name,
              "pt-BR",
          );
        })
        .map((item) => ({
          playerId:
            item.playerId,
          name:
            item.name,
          photoURL:
            item.photoURL || "",
          goals:
            item.goals,
        }));

  /*
   * Goleiro menos vazado:
   * continua oficial só após 3 jogos no gol.
   */
  const goalkeepers =
    all
        .filter(
            (item) =>
              item.goalkeeperGames >= 3,
        )
        .map((item) => ({
          playerId:
            item.playerId,
          name:
            item.name,
          photoURL:
            item.photoURL || "",
          games:
            item.goalkeeperGames,
          goalsConceded:
            item.goalsConceded,
          average:
            item.goalkeeperGames >
              0 ?
              item.goalsConceded /
                item.goalkeeperGames :
              0,
          balance:
            item.goals -
            item.goalsConceded,
        }))
        .sort((a, b) => {
          if (
            a.average !==
            b.average
          ) {
            return (
              a.average -
              b.average
            );
          }

          if (
            a.goalsConceded !==
            b.goalsConceded
          ) {
            return (
              a.goalsConceded -
              b.goalsConceded
            );
          }

          if (
            b.games !== a.games
          ) {
            return (
              b.games -
              a.games
            );
          }

          return a.name.localeCompare(
              b.name,
              "pt-BR",
          );
        });

  await db
      .collection("ranking")
      .doc("current")
      .set(
          {
            scorers,
            goalkeepers,
            updatedAt:
              FieldValue
                  .serverTimestamp(),
          },
          {merge: true},
      );

  return {
    scorers,
    goalkeepers,
  };
}


// ========================================================
// LISTA
// ========================================================

exports.listarConfirmados = onCall(
    {
      region:
        "southamerica-east1",
      timeoutSeconds: 15,
    },
    async (request) => {
      unifiedAuthOrThrow(
          request,
      );

      const db =
        getFirestore();

      const players =
        await unifiedConfirmedPlayers(
            db,
        );

      return {
        count:
          players.length,
        players:
          players.slice(
              0,
              100,
          ),
      };
    },
);


// ========================================================
// ESTATÍSTICAS DO RACHA
// ========================================================

exports.obterEstatisticasRacha = onCall(
    {
      region:
        "southamerica-east1",
      timeoutSeconds: 20,
    },
    async (request) => {
      unifiedAuthOrThrow(
          request,
      );

      const matchKey =
        unifiedSafeMatchKey(
            request.data
                ?.matchKey,
        );

      if (!matchKey) {
        throw new HttpsError(
            "invalid-argument",
            "Racha inválido.",
        );
      }

      const db =
        getFirestore();

      const confirmed =
        await unifiedConfirmedPlayers(
            db,
        );

      const statsSnapshot =
        await db
            .collection(
                "match_stats",
            )
            .where(
                "matchKey",
                "==",
                matchKey,
            )
            .get();

      const stats =
        new Map();

      statsSnapshot.docs.forEach(
          (docSnap) => {
            const data =
              docSnap.data() || {};

            stats.set(
                String(
                    data.playerId ||
                    "",
                ),
                data,
            );
          },
      );

      const players =
        confirmed.map(
            (player) => {
              const stat =
                stats.get(
                    player.id,
                ) || {};

              return {
                playerId:
                  player.id,
                name:
                  player.name,
                photoURL:
                  player.photoURL ||
                  "",
                goals:
                  Math.max(
                      0,
                      Math.floor(
                          Number(
                              stat.goals,
                          ) || 0,
                      ),
                  ),
                goalsConceded:
                  Math.max(
                      0,
                      Math.floor(
                          Number(
                              stat
                                  .goalsConceded,
                          ) || 0,
                      ),
                  ),
                isGoalkeeper:
                  stat
                      .isGoalkeeper ===
                  true,
              };
            },
        );

      return {
        matchKey,
        players,
      };
    },
);


// ========================================================
// ALTERAR GOL / GOL SOFRIDO
// ========================================================

exports.alterarEstatisticaJogador = onCall(
    {
      region:
        "southamerica-east1",
      timeoutSeconds: 30,
    },
    async (request) => {
      unifiedAdminOrThrow(
          request,
      );

      const matchKey =
        unifiedSafeMatchKey(
            request.data
                ?.matchKey,
        );

      const playerId =
        String(
            request.data
                ?.playerId || "",
        )
            .trim()
            .slice(0, 128);

      const field =
        String(
            request.data
                ?.field || "",
        );

      const delta =
        Number(
            request.data
                ?.delta,
        );

      const date =
        String(
            request.data
                ?.date || "",
        )
            .trim()
            .slice(0, 20);

      const time =
        String(
            request.data
                ?.time || "",
        )
            .trim()
            .slice(0, 10);

      if (
        !matchKey ||
        !playerId ||
        ![
          "goals",
          "goalsConceded",
        ].includes(field) ||
        ![-1, 1].includes(
            delta,
        )
      ) {
        throw new HttpsError(
            "invalid-argument",
            "Alteração inválida.",
        );
      }

      const db =
        getFirestore();

      const playerData =
        await unifiedGetConfirmedPlayerOrThrow(
            db,
            playerId,
        );

      const statRef =
        db
            .collection(
                "match_stats",
            )
            .doc(
                unifiedStatDocId(
                    matchKey,
                    playerId,
                ),
            );

      const result =
        await db.runTransaction(
            async (
                transaction,
            ) => {
              const snapshot =
                await transaction
                    .get(
                        statRef,
                    );

              const current =
                snapshot.exists ?
                  snapshot.data() ||
                    {} :
                  {};

              let goals =
                Math.max(
                    0,
                    Math.floor(
                        Number(
                            current
                                .goals,
                        ) || 0,
                    ),
                );

              let goalsConceded =
                Math.max(
                    0,
                    Math.floor(
                        Number(
                            current
                                .goalsConceded,
                        ) || 0,
                    ),
                );

              let isGoalkeeper =
                current
                    .isGoalkeeper ===
                true;

              if (
                field === "goals"
              ) {
                goals =
                  Math.max(
                      0,
                      goals +
                        delta,
                  );
              }

              if (
                field ===
                "goalsConceded"
              ) {
                if (
                  !isGoalkeeper &&
                  delta > 0
                ) {
                  isGoalkeeper =
                    true;
                }

                if (
                  !isGoalkeeper
                ) {
                  throw new HttpsError(
                      "failed-precondition",
                      "Marque o jogador como goleiro primeiro.",
                  );
                }

                goalsConceded =
                  Math.max(
                      0,
                      goalsConceded +
                        delta,
                  );
              }

              const value = {
                matchKey,
                date,
                time,
                playerId,
                name:
                  unifiedSafeName(
                      playerData
                          .name,
                  ),
                photoURL:
                  String(
                      playerData
                          .photoURL ||
                      "",
                  ).slice(
                      0,
                      2000,
                  ),
                goals,
                goalsConceded,
                isGoalkeeper,
                updatedBy:
                  request.auth
                      .uid,
                updatedAt:
                  FieldValue
                      .serverTimestamp(),
              };

              transaction.set(
                  statRef,
                  value,
                  {merge: true},
              );

              return value;
            },
        );

      await unifiedRecomputeRanking(
          db,
      );

      return {
        ok: true,
        player: {
          playerId,
          goals:
            result.goals,
          goalsConceded:
            result
                .goalsConceded,
          isGoalkeeper:
            result
                .isGoalkeeper,
        },
      };
    },
);


// ========================================================
// MARCAR GOLEIRO
// ========================================================

exports.marcarGoleiroRacha = onCall(
    {
      region:
        "southamerica-east1",
      timeoutSeconds: 30,
    },
    async (request) => {
      unifiedAdminOrThrow(
          request,
      );

      const matchKey =
        unifiedSafeMatchKey(
            request.data
                ?.matchKey,
        );

      const playerId =
        String(
            request.data
                ?.playerId || "",
        )
            .trim()
            .slice(0, 128);

      const isGoalkeeper =
        request.data
            ?.isGoalkeeper ===
        true;

      const date =
        String(
            request.data
                ?.date || "",
        )
            .trim()
            .slice(0, 20);

      const time =
        String(
            request.data
                ?.time || "",
        )
            .trim()
            .slice(0, 10);

      if (
        !matchKey ||
        !playerId
      ) {
        throw new HttpsError(
            "invalid-argument",
            "Jogador ou racha inválido.",
        );
      }

      const db =
        getFirestore();

      const playerData =
        await unifiedGetConfirmedPlayerOrThrow(
            db,
            playerId,
        );

      const statRef =
        db
            .collection(
                "match_stats",
            )
            .doc(
                unifiedStatDocId(
                    matchKey,
                    playerId,
                ),
            );

      const result =
        await db.runTransaction(
            async (
                transaction,
            ) => {
              const snapshot =
                await transaction
                    .get(
                        statRef,
                    );

              const current =
                snapshot.exists ?
                  snapshot.data() ||
                    {} :
                  {};

              const goals =
                Math.max(
                    0,
                    Math.floor(
                        Number(
                            current
                                .goals,
                        ) || 0,
                    ),
                );

              const goalsConceded =
                isGoalkeeper ?
                  Math.max(
                      0,
                      Math.floor(
                          Number(
                              current
                                  .goalsConceded,
                          ) || 0,
                      ),
                  ) :
                  0;

              const value = {
                matchKey,
                date,
                time,
                playerId,
                name:
                  unifiedSafeName(
                      playerData
                          .name,
                  ),
                photoURL:
                  String(
                      playerData
                          .photoURL ||
                      "",
                  ).slice(
                      0,
                      2000,
                  ),
                goals,
                goalsConceded,
                isGoalkeeper,
                updatedBy:
                  request.auth
                      .uid,
                updatedAt:
                  FieldValue
                      .serverTimestamp(),
              };

              transaction.set(
                  statRef,
                  value,
                  {merge: true},
              );

              return value;
            },
        );

      await unifiedRecomputeRanking(
          db,
      );

      return {
        ok: true,
        player: {
          playerId,
          goals:
            result.goals,
          goalsConceded:
            result
                .goalsConceded,
          isGoalkeeper:
            result
                .isGoalkeeper,
        },
      };
    },
);


// ========================================================
// RANKING
// ========================================================

exports.obterRanking = onCall(
    {
      region:
        "southamerica-east1",
      timeoutSeconds: 20,
    },
    async (request) => {
      unifiedAuthOrThrow(
          request,
      );

      const db =
        getFirestore();

      /*
       * Recalcula no momento da consulta.
       * Assim um recém-confirmado aparece
       * mesmo antes de fazer qualquer gol.
       */
      const ranking =
        await unifiedRecomputeRanking(
            db,
        );

      return ranking;
    },
);


// Compatibilidade com tela antiga escondida.
exports.carregarRankingRacha = onCall(
    {
      region:
        "southamerica-east1",
      timeoutSeconds: 15,
    },
    async (request) => {
      unifiedAdminOrThrow(
          request,
      );

      return {
        exists: false,
        scorers: [],
        goalkeepers: [],
      };
    },
);


exports.salvarRankingRacha = onCall(
    {
      region:
        "southamerica-east1",
      timeoutSeconds: 15,
    },
    async (request) => {
      unifiedAdminOrThrow(
          request,
      );

      throw new HttpsError(
          "failed-precondition",
          "Use a página Estatísticas para lançar os gols.",
      );
    },
);


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



/*
 * ==========================================================
 * GREEN PARK FC — FINANCEIRO / MENSALISTAS
 * ==========================================================
 */

const GREEN_PARK_ADMIN_UID_FINANCE =
  "d3nVt6SbQlO6lYnOcCUDbLBhoU02";


function financeAuthOrThrow(request) {
  if (!request.auth) {
    throw new HttpsError(
        "unauthenticated",
        "É necessário estar autenticado.",
    );
  }
}


function financeAdminOrThrow(request) {
  financeAuthOrThrow(request);

  if (
    request.auth.uid !==
    GREEN_PARK_ADMIN_UID_FINANCE
  ) {
    throw new HttpsError(
        "permission-denied",
        "Apenas o administrador pode acessar o financeiro.",
    );
  }
}


function financeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ?
    number :
    0;
}


function financeMoney(value) {
  return Math.round(
      Math.max(
          0,
          financeNumber(value),
      ) * 100,
  ) / 100;
}


function financeString(
    value,
    max = 120,
) {
  return String(value || "")
      .trim()
      .slice(0, max);
}


function financeSaoPauloParts() {
  const formatter =
    new Intl.DateTimeFormat(
        "en-US",
        {
          timeZone:
            "America/Sao_Paulo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        },
    );

  const parts =
    formatter.formatToParts(
        new Date(),
    );

  const map = {};

  parts.forEach((part) => {
    map[part.type] =
      part.value;
  });

  return {
    year: map.year,
    month: map.month,
    day: map.day,
    monthKey:
      map.year +
      "-" +
      map.month,
    dayKey:
      map.year +
      "-" +
      map.month +
      "-" +
      map.day,
  };
}


function financeTimestampMs(value) {
  if (!value) return 0;

  if (
    typeof value.toMillis ===
    "function"
  ) {
    return value.toMillis();
  }

  if (
    typeof value === "number"
  ) {
    return value;
  }

  const parsed =
    Date.parse(value);

  return Number.isFinite(parsed) ?
    parsed :
    0;
}


function financeDayMonthKeys(ms) {
  if (!ms) {
    return {
      dayKey: "",
      monthKey: "",
      dateLabel: "",
    };
  }

  const date =
    new Date(ms);

  const formatter =
    new Intl.DateTimeFormat(
        "en-US",
        {
          timeZone:
            "America/Sao_Paulo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        },
    );

  const parts =
    formatter.formatToParts(
        date,
    );

  const map = {};

  parts.forEach((part) => {
    map[part.type] =
      part.value;
  });

  return {
    dayKey:
      map.year +
      "-" +
      map.month +
      "-" +
      map.day,
    monthKey:
      map.year +
      "-" +
      map.month,
    dateLabel:
      map.day +
      "/" +
      map.month +
      "/" +
      map.year,
  };
}


function financeApproved(data) {
  const status =
    String(
        data?.status || "",
    )
        .toLowerCase()
        .trim();

  return (
    data?.webhookConfirmed ===
      true ||
    data?.paid === true ||
    [
      "approved",
      "paid",
      "processed",
      "accredited",
    ].includes(status)
  );
}


function financePaymentAmount(data) {
  const candidates = [
    data?.amount,
    data?.transactionAmount,
    data?.transaction_amount,
    data?.totalAmount,
    data?.total_amount,
    data?.total,
  ];

  for (
    const value of
    candidates
  ) {
    const amount =
      financeMoney(value);

    if (amount > 0) {
      return amount;
    }
  }

  return 0;
}


function financePaymentMs(data) {
  const candidates = [
    data?.approvedAt,
    data?.paidAt,
    data?.webhookConfirmedAt,
    data?.updatedAt,
    data?.createdAt,
  ];

  for (
    const value of
    candidates
  ) {
    const ms =
      financeTimestampMs(
          value,
      );

    if (ms) return ms;
  }

  return 0;
}


async function financeSettings(db) {
  const snapshot =
    await db
        .collection(
            "finance_settings",
        )
        .doc("current")
        .get();

  const data =
    snapshot.exists ?
      snapshot.data() || {} :
      {};

  return {
    dailyPrice:
      financeMoney(
          data.dailyPrice || 15,
      ),
    monthlyPrice:
      financeMoney(
          data.monthlyPrice || 70,
      ),
    openingBalance:
      financeNumber(
          data.openingBalance || 0,
      ),
  };
}


async function financeUpdateConfirmedCount(
    db,
) {
  const snapshot =
    await db
        .collection("players")
        .where(
            "status",
            "==",
            "confirmed",
        )
        .get();

  await db
      .collection("racha")
      .doc("current")
      .set(
          {
            confirmedCount:
              snapshot.size,
            countUpdatedAt:
              FieldValue
                  .serverTimestamp(),
          },
          {merge: true},
      );

  return snapshot.size;
}


exports.salvarConfiguracaoFinanceira = onCall(
    {
      region:
        "southamerica-east1",
      timeoutSeconds: 15,
    },
    async (request) => {
      financeAdminOrThrow(
          request,
      );

      const dailyPrice =
        financeMoney(
            request.data
                ?.dailyPrice,
        );

      const monthlyPrice =
        financeMoney(
            request.data
                ?.monthlyPrice,
        );

      const openingBalance =
        Math.round(
            financeNumber(
                request.data
                    ?.openingBalance,
            ) * 100,
        ) / 100;

      if (
        dailyPrice <= 0 ||
        monthlyPrice <= 0
      ) {
        throw new HttpsError(
            "invalid-argument",
            "Os valores da diária e mensalidade devem ser maiores que zero.",
        );
      }

      const db =
        getFirestore();

      await db
          .collection(
              "finance_settings",
          )
          .doc("current")
          .set(
              {
                dailyPrice,
                monthlyPrice,
                openingBalance,
                updatedAt:
                  FieldValue
                      .serverTimestamp(),
                updatedBy:
                  request.auth.uid,
              },
              {merge: true},
          );

      return {ok: true};
    },
);


exports.listarControlePagamentos = onCall(
    {
      region:
        "southamerica-east1",
      timeoutSeconds: 20,
    },
    async (request) => {
      financeAdminOrThrow(
          request,
      );

      const db =
        getFirestore();

      const current =
        financeSaoPauloParts();

      const snapshot =
        await db
            .collection("players")
            .get();

      const players =
        snapshot.docs.map(
            (docSnap) => {
              const data =
                docSnap.data() || {};

              const billingType =
                data.billingType ===
                  "monthly" ?
                  "monthly" :
                  "daily";

              const monthlyPaidThrough =
                financeString(
                    data
                        .monthlyPaidThrough,
                    7,
                );

              return {
                id:
                  docSnap.id,
                name:
                  financeString(
                      data.name ||
                      "Jogador",
                      60,
                  ),
                billingType,
                monthlyPaidThrough,
                monthlyActive:
                  billingType ===
                    "monthly" &&
                  monthlyPaidThrough >=
                    current.monthKey,
                status:
                  financeString(
                      data.status,
                      30,
                  ),
              };
            },
        )
            .filter(
                (item) =>
                  item.name &&
                  item.name !==
                    "Jogador",
            )
            .sort(
                (a, b) =>
                  a.name.localeCompare(
                      b.name,
                      "pt-BR",
                  ),
            );

      return {players};
    },
);


exports.definirPlanoJogador = onCall(
    {
      region:
        "southamerica-east1",
      timeoutSeconds: 15,
    },
    async (request) => {
      financeAdminOrThrow(
          request,
      );

      const playerId =
        financeString(
            request.data
                ?.playerId,
            128,
        );

      const billingType =
        request.data
            ?.billingType ===
          "monthly" ?
          "monthly" :
          "daily";

      if (!playerId) {
        throw new HttpsError(
            "invalid-argument",
            "Jogador inválido.",
        );
      }

      const db =
        getFirestore();

      const ref =
        db
            .collection("players")
            .doc(playerId);

      const snapshot =
        await ref.get();

      if (!snapshot.exists) {
        throw new HttpsError(
            "not-found",
            "Jogador não encontrado.",
        );
      }

      const patch = {
        billingType,
        updatedAt:
          FieldValue
              .serverTimestamp(),
      };

      if (
        billingType ===
        "daily"
      ) {
        patch.monthlyPaidThrough =
          "";
      }

      await ref.set(
          patch,
          {merge: true},
      );

      return {
        ok: true,
        billingType,
      };
    },
);


exports.registrarMensalidade = onCall(
    {
      region:
        "southamerica-east1",
      timeoutSeconds: 20,
    },
    async (request) => {
      financeAdminOrThrow(
          request,
      );

      const playerId =
        financeString(
            request.data
                ?.playerId,
            128,
        );

      const method =
        financeString(
            request.data
                ?.method || "Pix",
            30,
        );

      if (!playerId) {
        throw new HttpsError(
            "invalid-argument",
            "Jogador inválido.",
        );
      }

      const db =
        getFirestore();

      const playerRef =
        db
            .collection("players")
            .doc(playerId);

      const playerSnapshot =
        await playerRef.get();

      if (!playerSnapshot.exists) {
        throw new HttpsError(
            "not-found",
            "Jogador não encontrado.",
        );
      }

      const player =
        playerSnapshot.data() || {};

      const settings =
        await financeSettings(db);

      const current =
        financeSaoPauloParts();

      const receiptId =
        playerId +
        "__" +
        current.monthKey;

      const receiptRef =
        db
            .collection(
                "finance_receipts",
            )
            .doc(receiptId);

      const existing =
        await receiptRef.get();

      if (existing.exists) {
        throw new HttpsError(
            "already-exists",
            "A mensalidade deste jogador já foi registrada neste mês.",
        );
      }

      const batch =
        db.batch();

      batch.set(
          receiptRef,
          {
            playerId,
            name:
              financeString(
                  player.name ||
                  "Jogador",
                  60,
              ),
            amount:
              settings
                  .monthlyPrice,
            type:
              "monthly",
            method,
            paidMonth:
              current.monthKey,
            status:
              "approved",
            createdAt:
              FieldValue
                  .serverTimestamp(),
            createdBy:
              request.auth.uid,
          },
      );

      batch.set(
          playerRef,
          {
            billingType:
              "monthly",
            monthlyPaidThrough:
              current.monthKey,
            updatedAt:
              FieldValue
                  .serverTimestamp(),
          },
          {merge: true},
      );

      await batch.commit();

      return {
        ok: true,
        month:
          current.monthKey,
        amount:
          settings.monthlyPrice,
      };
    },
);


exports.registrarDespesa = onCall(
    {
      region:
        "southamerica-east1",
      timeoutSeconds: 15,
    },
    async (request) => {
      financeAdminOrThrow(
          request,
      );

      const description =
        financeString(
            request.data
                ?.description,
            100,
        );

      const amount =
        financeMoney(
            request.data
                ?.amount,
        );

      const category =
        financeString(
            request.data
                ?.category ||
              "Outros",
            40,
        );

      const method =
        financeString(
            request.data
                ?.method || "Pix",
            30,
        );

      if (
        description.length < 2 ||
        amount <= 0
      ) {
        throw new HttpsError(
            "invalid-argument",
            "Descrição e valor são obrigatórios.",
        );
      }

      const db =
        getFirestore();

      const ref =
        await db
            .collection(
                "finance_expenses",
            )
            .add(
                {
                  description,
                  amount,
                  category,
                  method,
                  createdAt:
                    FieldValue
                        .serverTimestamp(),
                  createdBy:
                    request.auth.uid,
                },
            );

      return {
        ok: true,
        id: ref.id,
      };
    },
);


exports.obterMeuPlano = onCall(
    {
      region:
        "southamerica-east1",
      timeoutSeconds: 15,
    },
    async (request) => {
      financeAuthOrThrow(
          request,
      );

      const db =
        getFirestore();

      const snapshot =
        await db
            .collection("players")
            .doc(
                request.auth.uid,
            )
            .get();

      const current =
        financeSaoPauloParts();

      if (!snapshot.exists) {
        return {
          billingType:
            "daily",
          monthlyPaidThrough:
            "",
          monthlyActive:
            false,
        };
      }

      const data =
        snapshot.data() || {};

      const billingType =
        data.billingType ===
          "monthly" ?
          "monthly" :
          "daily";

      const monthlyPaidThrough =
        financeString(
            data
                .monthlyPaidThrough,
            7,
        );

      return {
        billingType,
        monthlyPaidThrough,
        monthlyActive:
          billingType ===
            "monthly" &&
          monthlyPaidThrough >=
            current.monthKey,
      };
    },
);


exports.confirmarPresencaMensalista = onCall(
    {
      region:
        "southamerica-east1",
      timeoutSeconds: 20,
    },
    async (request) => {
      financeAuthOrThrow(
          request,
      );

      if (
        request.auth.uid ===
        GREEN_PARK_ADMIN_UID_FINANCE
      ) {
        throw new HttpsError(
            "failed-precondition",
            "O administrador não pode confirmar presença como jogador.",
        );
      }

      const db =
        getFirestore();

      const ref =
        db
            .collection("players")
            .doc(
                request.auth.uid,
            );

      const snapshot =
        await ref.get();

      if (!snapshot.exists) {
        throw new HttpsError(
            "not-found",
            "Faça seu cadastro primeiro.",
        );
      }

      const data =
        snapshot.data() || {};

      const current =
        financeSaoPauloParts();

      if (
        data.billingType !==
        "monthly"
      ) {
        throw new HttpsError(
            "failed-precondition",
            "Seu plano atual é diarista.",
        );
      }

      const paidThrough =
        financeString(
            data
                .monthlyPaidThrough,
            7,
        );

      if (
        paidThrough <
        current.monthKey
      ) {
        throw new HttpsError(
            "failed-precondition",
            "Sua mensalidade deste mês ainda não foi marcada como paga.",
        );
      }

      await ref.set(
          {
            status:
              "confirmed",
            confirmedAt:
              FieldValue
                  .serverTimestamp(),
            attendanceType:
              "monthly",
            updatedAt:
              FieldValue
                  .serverTimestamp(),
          },
          {merge: true},
      );

      const count =
        await financeUpdateConfirmedCount(
            db,
        );

      return {
        confirmed: true,
        confirmedCount:
          count,
      };
    },
);


exports.prepararNovoRacha = onCall(
    {
      region:
        "southamerica-east1",
      timeoutSeconds: 60,
    },
    async (request) => {
      financeAdminOrThrow(
          request,
      );

      const db =
        getFirestore();

      const snapshot =
        await db
            .collection("players")
            .get();

      const docs =
        snapshot.docs;

      for (
        let index = 0;
        index < docs.length;
        index += 400
      ) {
        const batch =
          db.batch();

        docs
            .slice(
                index,
                index + 400,
            )
            .forEach(
                (docSnap) => {
                  batch.set(
                      docSnap.ref,
                      {
                        status:
                          "registered",
                        attendanceType:
                          "",
                        confirmedAt:
                          FieldValue
                              .delete(),
                        updatedAt:
                          FieldValue
                              .serverTimestamp(),
                      },
                      {merge: true},
                  );
                },
            );

        await batch.commit();
      }

      await db
          .collection("racha")
          .doc("current")
          .set(
              {
                confirmedCount:
                  0,
                nextDate:
                  financeString(
                      request.data
                          ?.date,
                      20,
                  ),
                nextTime:
                  financeString(
                      request.data
                          ?.time,
                      10,
                  ),
                attendanceResetAt:
                  FieldValue
                      .serverTimestamp(),
              },
              {merge: true},
          );

      return {
        ok: true,
        playersPreserved:
          docs.length,
      };
    },
);


exports.obterDashboardFinanceiro = onCall(
    {
      region:
        "southamerica-east1",
      timeoutSeconds: 30,
    },
    async (request) => {
      financeAdminOrThrow(
          request,
      );

      const db =
        getFirestore();

      const current =
        financeSaoPauloParts();

      const [
        settings,
        playersSnapshot,
        expensesSnapshot,
        receiptsSnapshot,
        paymentsSnapshot,
        pixSnapshot,
      ] = await Promise.all([
        financeSettings(db),
        db
            .collection(
                "players",
            )
            .get(),
        db
            .collection(
                "finance_expenses",
            )
            .get(),
        db
            .collection(
                "finance_receipts",
            )
            .get(),
        db
            .collection(
                "payments",
            )
            .get(),
        db
            .collection(
                "pix_orders",
            )
            .get(),
      ]);

      let monthlyCount = 0;
      let dailyCount = 0;
      let monthlyPaidCount = 0;

      playersSnapshot.docs.forEach(
          (docSnap) => {
            const data =
              docSnap.data() || {};

            if (
              data.billingType ===
              "monthly"
            ) {
              monthlyCount += 1;

              const paidThrough =
                financeString(
                    data
                        .monthlyPaidThrough,
                    7,
                );

              if (
                paidThrough >=
                current.monthKey
              ) {
                monthlyPaidCount +=
                  1;
              }
            } else {
              dailyCount += 1;
            }
          },
      );

      const incomes =
        new Map();

      function addIncome(
          key,
          data,
          source,
      ) {
        if (
          !financeApproved(data)
        ) {
          return;
        }

        const amount =
          financePaymentAmount(
              data,
          );

        if (
          amount <= 0
        ) {
          return;
        }

        const ms =
          financePaymentMs(
              data,
          );

        const keys =
          financeDayMonthKeys(
              ms,
          );

        incomes.set(
            key,
            {
              amount,
              ms,
              dayKey:
                keys.dayKey,
              monthKey:
                keys.monthKey,
              dateLabel:
                keys.dateLabel,
              type:
                financeString(
                    data.type ||
                    data.paymentType ||
                    "daily",
                    30,
                ),
              method:
                financeString(
                    data.method ||
                    (source ===
                      "pix" ?
                      "Pix" :
                      "Pagamento"),
                    30,
                ),
              name:
                financeString(
                    data.name ||
                    data.payerName ||
                    "Jogador",
                    60,
                ),
              source,
            },
        );
      }

      /*
       * Pix automático.
       */
      pixSnapshot.docs.forEach(
          (docSnap) => {
            const data =
              docSnap.data() || {};

            const externalId =
              financeString(
                  data.orderId ||
                  data.id ||
                  docSnap.id,
                  180,
              );

            addIncome(
                "pix:" +
                externalId,
                data,
                "pix",
            );
          },
      );

      /*
       * Pagamentos antigos/manuais.
       * Se tiver orderId igual ao Pix,
       * usa a mesma chave para não
       * contar duas vezes.
       */
      paymentsSnapshot.docs.forEach(
          (docSnap) => {
            const data =
              docSnap.data() || {};

            const orderId =
              financeString(
                  data.orderId ||
                  data.providerOrderId,
                  180,
              );

            const key =
              orderId ?
                "pix:" +
                  orderId :
                "payment:" +
                  docSnap.id;

            addIncome(
                key,
                data,
                "payment",
            );
          },
      );

      /*
       * Mensalidades registradas
       * pelo painel financeiro.
       */
      receiptsSnapshot.docs.forEach(
          (docSnap) => {
            const data =
              docSnap.data() || {};

            addIncome(
                "receipt:" +
                docSnap.id,
                data,
                "monthly",
            );
          },
      );

      let receivedTotal = 0;
      let receivedToday = 0;
      let receivedMonth = 0;

      const movements = [];

      incomes.forEach((item) => {
        receivedTotal +=
          item.amount;

        if (
          item.dayKey ===
          current.dayKey
        ) {
          receivedToday +=
            item.amount;
        }

        if (
          item.monthKey ===
          current.monthKey
        ) {
          receivedMonth +=
            item.amount;
        }

        movements.push(
            {
              kind:
                "income",
              title:
                (
                  item.type ===
                  "monthly" ?
                  "Mensalidade • " :
                  "Diária • "
                ) +
                item.name,
              amount:
                item.amount,
              method:
                item.method,
              dateLabel:
                item.dateLabel,
              ms:
                item.ms,
            },
        );
      });

      let expensesTotal = 0;
      let expensesToday = 0;
      let expensesMonth = 0;

      expensesSnapshot.docs.forEach(
          (docSnap) => {
            const data =
              docSnap.data() || {};

            const amount =
              financeMoney(
                  data.amount,
              );

            const ms =
              financePaymentMs(
                  data,
              );

            const keys =
              financeDayMonthKeys(
                  ms,
              );

            expensesTotal +=
              amount;

            if (
              keys.dayKey ===
              current.dayKey
            ) {
              expensesToday +=
                amount;
            }

            if (
              keys.monthKey ===
              current.monthKey
            ) {
              expensesMonth +=
                amount;
            }

            movements.push(
                {
                  kind:
                    "expense",
                  title:
                    financeString(
                        data.description ||
                        "Despesa",
                        100,
                    ),
                  amount,
                  method:
                    financeString(
                        data.method ||
                        data.category ||
                        "Despesa",
                        30,
                    ),
                  dateLabel:
                    keys.dateLabel,
                  ms,
                },
            );
          },
      );

      movements.sort(
          (a, b) =>
            b.ms - a.ms,
      );

      const balance =
        Math.round(
            (
              settings
                  .openingBalance +
              receivedTotal -
              expensesTotal
            ) * 100,
        ) / 100;

      return {
        balance,
        receivedToday:
          Math.round(
              receivedToday *
              100,
          ) / 100,
        receivedMonth:
          Math.round(
              receivedMonth *
              100,
          ) / 100,
        expensesToday:
          Math.round(
              expensesToday *
              100,
          ) / 100,
        expensesMonth:
          Math.round(
              expensesMonth *
              100,
          ) / 100,
        monthlyCount,
        monthlyPaidCount,
        dailyCount,
        settings,
        movements:
          movements.slice(
              0,
              30,
          ),
      };
    },
);
