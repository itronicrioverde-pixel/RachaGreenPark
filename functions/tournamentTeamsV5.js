"use strict";

const {
  onCall,
  HttpsError,
} = require("firebase-functions/v2/https");

const {
  onDocumentDeleted,
} = require("firebase-functions/v2/firestore");

const {
  getFirestore,
  FieldValue,
} = require("firebase-admin/firestore");

const {
  getStorage,
} = require("firebase-admin/storage");


const ADMIN_UID =
  "d3nVt6SbQlO6lYnOcCUDbLBhoU02";

const CALL_OPTIONS = {
  invoker: "public",
  region: "southamerica-east1",
  timeoutSeconds: 30,
};


function authOrThrow(request) {
  if (!request.auth) {
    throw new HttpsError(
        "unauthenticated",
        "É necessário estar autenticado.",
    );
  }
}


function adminOrThrow(request) {
  authOrThrow(request);

  if (request.auth.uid !== ADMIN_UID) {
    throw new HttpsError(
        "permission-denied",
        "Apenas o administrador pode alterar as equipes.",
    );
  }
}


function safeString(
    value,
    max = 120,
) {
  return String(value || "")
      .trim()
      .slice(0, max);
}


function safeId(value) {
  const id =
    safeString(value, 128);

  if (
    !id ||
    id.includes("/")
  ) {
    return "";
  }

  return id;
}


function safeLogoUrl(value) {
  const url =
    safeString(value, 2000);

  if (!url) {
    return "";
  }

  if (
    !url.startsWith("https://") &&
    !url.startsWith("http://")
  ) {
    return "";
  }

  return url;
}


function validLogoPath(
    tournamentId,
    teamId,
    rawPath,
) {
  const path =
    safeString(rawPath, 500);

  if (!path) {
    return false;
  }

  const prefix =
    "tournaments/" +
    tournamentId +
    "/teams/" +
    teamId +
    "/";

  return (
    path.startsWith(prefix) &&
    !path.includes("..")
  );
}


async function currentTournamentOrThrow(
    db,
    rawTournamentId,
) {
  const tournamentId =
    safeId(rawTournamentId);

  if (!tournamentId) {
    throw new HttpsError(
        "invalid-argument",
        "Campeonato inválido.",
    );
  }

  const settingsSnapshot =
    await db
        .collection("tournament_settings")
        .doc("current")
        .get();

  const currentId =
    settingsSnapshot.exists ?
      safeId(
          settingsSnapshot
              .data()
              ?.currentTournamentId,
      ) :
      "";

  if (
    !currentId ||
    currentId !== tournamentId
  ) {
    throw new HttpsError(
        "failed-precondition",
        "Atualize a tela do campeonato.",
    );
  }

  const tournamentRef =
    db
        .collection("tournaments")
        .doc(tournamentId);

  const tournamentSnapshot =
    await tournamentRef.get();

  if (!tournamentSnapshot.exists) {
    throw new HttpsError(
        "not-found",
        "Campeonato não encontrado.",
    );
  }

  return {
    tournamentId,
    tournamentRef,
    tournamentData:
      tournamentSnapshot.data() || {},
  };
}


async function configuredTeamsLimit(
    context,
) {
  const formatSnapshot =
    await context
        .tournamentRef
        .collection("settings")
        .doc("format")
        .get();

  const formatData =
    formatSnapshot.exists ?
      formatSnapshot.data() || {} :
      {};

  let limit =
    Number(
        formatData.teamsCount,
    );

  if (
    !Number.isInteger(limit) ||
    limit < 3 ||
    limit > 32
  ) {
    limit =
      Number(
          context
              .tournamentData
              ?.teamsCount,
      );
  }

  if (
    !Number.isInteger(limit) ||
    limit < 3 ||
    limit > 32
  ) {
    limit = 10;
  }

  return limit;
}


async function deleteStoragePathQuietly(
    rawPath,
) {
  const path =
    safeString(rawPath, 500);

  if (!path) {
    return;
  }

  try {
    await getStorage()
        .bucket()
        .file(path)
        .delete({
          ignoreNotFound: true,
        });
  } catch (error) {
    console.warn(
        "Falha removendo escudo antigo:",
        path,
        error?.message || error,
    );
  }
}


function teamPayload(
    snapshot,
) {
  const data =
    snapshot.data() || {};

  return {
    id: snapshot.id,
    name:
      safeString(
          data.name,
          40,
      ),
    logoURL:
      safeLogoUrl(
          data.logoURL,
      ),
    order:
      Number(
          data.order || 0,
      ),
  };
}


exports.listarEquipesTorneio =
onCall(
    CALL_OPTIONS,
    async (request) => {
      authOrThrow(request);

      const db =
        getFirestore();

      const context =
        await currentTournamentOrThrow(
            db,
            request.data?.tournamentId,
        );

      const [
        teamsSnapshot,
        teamsLimit,
      ] =
        await Promise.all([
          context
              .tournamentRef
              .collection("teams")
              .get(),
          configuredTeamsLimit(
              context,
          ),
        ]);

      const teams =
        teamsSnapshot.docs
            .map(teamPayload)
            .sort(
                (a, b) => {
                  const orderDiff =
                    Number(a.order || 0) -
                    Number(b.order || 0);

                  if (orderDiff !== 0) {
                    return orderDiff;
                  }

                  return a.name.localeCompare(
                      b.name,
                      "pt-BR",
                      {
                        sensitivity:
                          "base",
                      },
                  );
                },
            );

      return {
        teams,
        teamsLimit,
      };
    },
);


exports.salvarEquipeTorneio =
onCall(
    CALL_OPTIONS,
    async (request) => {
      adminOrThrow(request);

      const db =
        getFirestore();

      const context =
        await currentTournamentOrThrow(
            db,
            request.data?.tournamentId,
        );

      const data =
        request.data || {};

      const requestedTeamId =
        safeId(data.teamId);

      const name =
        safeString(
            data.name,
            40,
        );

      if (name.length < 2) {
        throw new HttpsError(
            "invalid-argument",
            "Informe o nome da equipe.",
        );
      }

      const teamsRef =
        context
            .tournamentRef
            .collection("teams");

      const teamsSnapshot =
        await teamsRef.get();

      const normalizedName =
        name.toLocaleLowerCase(
            "pt-BR",
        );

      const duplicate =
        teamsSnapshot.docs.some(
            (docSnapshot) => {
              if (
                requestedTeamId &&
                docSnapshot.id ===
                  requestedTeamId
              ) {
                return false;
              }

              const currentName =
                safeString(
                    docSnapshot
                        .data()
                        ?.name,
                    40,
                )
                    .toLocaleLowerCase(
                        "pt-BR",
                    );

              return (
                currentName ===
                normalizedName
              );
            },
        );

      if (duplicate) {
        throw new HttpsError(
            "already-exists",
            "Já existe uma equipe com esse nome.",
        );
      }

      let teamRef;
      let oldData = {};
      let creating = false;

      if (requestedTeamId) {
        teamRef =
          teamsRef.doc(
              requestedTeamId,
          );

        const teamSnapshot =
          await teamRef.get();

        if (!teamSnapshot.exists) {
          throw new HttpsError(
              "not-found",
              "Equipe não encontrada.",
          );
        }

        oldData =
          teamSnapshot.data() || {};
      } else {
        const limit =
          await configuredTeamsLimit(
              context,
          );

        if (
          teamsSnapshot.size >=
          limit
        ) {
          throw new HttpsError(
              "failed-precondition",
              "A quantidade máxima de equipes foi atingida.",
          );
        }

        teamRef =
          teamsRef.doc();

        creating = true;
      }

      const patch = {
        name,
        updatedBy:
          request.auth.uid,
        updatedAt:
          FieldValue.serverTimestamp(),
      };

      if (creating) {
        const maxOrder =
          teamsSnapshot.docs.reduce(
              (max, docSnapshot) =>
                Math.max(
                    max,
                    Number(
                        docSnapshot
                            .data()
                            ?.order ||
                        0,
                    ),
                ),
              0,
          );

        patch.order =
          maxOrder + 1;

        patch.logoURL = "";
        patch.logoStoragePath = "";

        patch.createdBy =
          request.auth.uid;

        patch.createdAt =
          FieldValue.serverTimestamp();
      }

      const oldLogoPath =
        safeString(
            oldData.logoStoragePath,
            500,
        );

      let nextLogoPath =
        oldLogoPath;

      if (data.removeLogo === true) {
        patch.logoURL = "";
        patch.logoStoragePath = "";
        nextLogoPath = "";
      } else if (
        Object.prototype
            .hasOwnProperty
            .call(
                data,
                "logoURL",
            )
      ) {
        const logoURL =
          safeLogoUrl(
              data.logoURL,
          );

        const logoStoragePath =
          safeString(
              data.logoStoragePath,
              500,
          );

        if (
          !logoURL ||
          !validLogoPath(
              context.tournamentId,
              teamRef.id,
              logoStoragePath,
          )
        ) {
          throw new HttpsError(
              "invalid-argument",
              "Escudo da equipe inválido.",
          );
        }

        patch.logoURL =
          logoURL;

        patch.logoStoragePath =
          logoStoragePath;

        nextLogoPath =
          logoStoragePath;
      }

      await teamRef.set(
          patch,
          {
            merge: true,
          },
      );

      if (
        oldLogoPath &&
        oldLogoPath !==
          nextLogoPath
      ) {
        await deleteStoragePathQuietly(
            oldLogoPath,
        );
      }

      const savedSnapshot =
        await teamRef.get();

      return {
        ok: true,
        team:
          teamPayload(
              savedSnapshot,
          ),
      };
    },
);


exports.removerEquipeTorneio =
onCall(
    CALL_OPTIONS,
    async (request) => {
      adminOrThrow(request);

      const db =
        getFirestore();

      const context =
        await currentTournamentOrThrow(
            db,
            request.data?.tournamentId,
        );

      const teamId =
        safeId(
            request.data?.teamId,
        );

      if (!teamId) {
        throw new HttpsError(
            "invalid-argument",
            "Equipe inválida.",
        );
      }

      const teamRef =
        context
            .tournamentRef
            .collection("teams")
            .doc(teamId);

      const teamSnapshot =
        await teamRef.get();

      if (!teamSnapshot.exists) {
        throw new HttpsError(
            "not-found",
            "Equipe não encontrada.",
        );
      }

      const teamData =
        teamSnapshot.data() || {};

      const assignedSnapshot =
        await context
            .tournamentRef
            .collection("players")
            .where(
                "teamId",
                "==",
                teamId,
            )
            .get();

      const batch =
        db.batch();

      assignedSnapshot.docs
          .forEach(
              (playerSnapshot) => {
                batch.set(
                    playerSnapshot.ref,
                    {
                      teamId: "",
                      teamUpdatedBy:
                        request.auth.uid,
                      teamUpdatedAt:
                        FieldValue
                            .serverTimestamp(),
                    },
                    {
                      merge: true,
                    },
                );
              },
          );

      batch.delete(
          teamRef,
      );

      await batch.commit();

      await deleteStoragePathQuietly(
          teamData.logoStoragePath,
      );

      return {
        ok: true,
        releasedPlayers:
          assignedSnapshot.size,
      };
    },
);


exports.atribuirJogadorEquipeTorneio =
onCall(
    CALL_OPTIONS,
    async (request) => {
      adminOrThrow(request);

      const db =
        getFirestore();

      const context =
        await currentTournamentOrThrow(
            db,
            request.data?.tournamentId,
        );

      const playerId =
        safeId(
            request.data?.playerId,
        );

      const teamId =
        safeId(
            request.data?.teamId,
        );

      if (!playerId) {
        throw new HttpsError(
            "invalid-argument",
            "Jogador inválido.",
        );
      }

      const playerRef =
        context
            .tournamentRef
            .collection("players")
            .doc(playerId);

      const playerSnapshot =
        await playerRef.get();

      if (!playerSnapshot.exists) {
        throw new HttpsError(
            "not-found",
            "Jogador não está inscrito neste campeonato.",
        );
      }

      if (teamId) {
        const teamSnapshot =
          await context
              .tournamentRef
              .collection("teams")
              .doc(teamId)
              .get();

        if (!teamSnapshot.exists) {
          throw new HttpsError(
              "not-found",
              "Equipe não encontrada.",
          );
        }
      }

      await playerRef.set(
          {
            teamId,
            teamUpdatedBy:
              request.auth.uid,
            teamUpdatedAt:
              FieldValue.serverTimestamp(),
          },
          {
            merge: true,
          },
      );

      return {
        ok: true,
        playerId,
        teamId,
      };
    },
);


exports.limparArquivosTorneioExcluido =
onDocumentDeleted(
    {
      document:
        "tournaments/{tournamentId}",
      region:
        "southamerica-east1",
    },
    async (event) => {
      const tournamentId =
        safeId(
            event.params.tournamentId,
        );

      if (!tournamentId) {
        return;
      }

      const prefix =
        "tournaments/" +
        tournamentId +
        "/teams/";

      try {
        await getStorage()
            .bucket()
            .deleteFiles({
              prefix,
            });

        console.log(
            "Arquivos do torneio removidos:",
            tournamentId,
        );
      } catch (error) {
        console.warn(
            "Falha limpando arquivos do torneio:",
            tournamentId,
            error?.message || error,
        );
      }
    },
);
