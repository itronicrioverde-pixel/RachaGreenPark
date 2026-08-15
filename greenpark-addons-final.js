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
