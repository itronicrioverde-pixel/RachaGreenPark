"use strict";

const {
  onCall,
  HttpsError,
} = require("firebase-functions/v2/https");

const {
  getFirestore,
  FieldValue,
} = require("firebase-admin/firestore");


const ADMIN_UID =
  "d3nVt6SbQlO6lYnOcCUDbLBhoU02";

const CALL_OPTIONS = {
  invoker: "public",
  region: "southamerica-east1",
  timeoutSeconds: 20,
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
        "Apenas o administrador pode alterar o torneio.",
    );
  }
}


function safeString(value, max = 120) {
  return String(value || "")
      .trim()
      .slice(0, max);
}


function safeId(value) {
  const id = safeString(value, 128);

  if (!id || id.includes("/")) {
    return "";
  }

  return id;
}


function paymentStatus(value) {
  const status = safeString(value, 20);

  if (
    status === "paid" ||
    status === "exempt"
  ) {
    return status;
  }

  return "pending";
}


function registrationFee(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return 0;
  }

  return Math.max(
      0,
      Math.round(amount * 100) / 100,
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

  const snapshot =
    await tournamentRef.get();

  if (!snapshot.exists) {
    throw new HttpsError(
        "not-found",
        "Campeonato não encontrado.",
    );
  }

  return {
    tournamentId,
    tournamentRef,
    data: snapshot.data() || {},
  };
}


exports.listarCatalogoJogadoresTorneio =
onCall(
    CALL_OPTIONS,
    async (request) => {
      adminOrThrow(request);

      const db = getFirestore();

      const snapshot =
        await db
            .collection("players")
            .get();

      const players =
        snapshot.docs
            .filter(
                (docSnapshot) =>
                  docSnapshot.id !==
                  ADMIN_UID,
            )
            .map((docSnapshot) => {
              const data =
                docSnapshot.data() ||
                {};

              return {
                id: docSnapshot.id,
                name:
                  safeString(
                      data.name ||
                      data.nickname ||
                      "Jogador",
                      100,
                  ),
                photoURL:
                  safeString(
                      data.photoURL,
                      2000,
                  ),
                position:
                  data.position ===
                    "goalkeeper" ?
                    "goalkeeper" :
                    "field",
              };
            })
            .filter(
                (player) =>
                  player.id &&
                  player.name,
            )
            .sort(
                (a, b) =>
                  a.name.localeCompare(
                      b.name,
                      "pt-BR",
                      {
                        sensitivity:
                          "base",
                      },
                  ),
            );

      return {players};
    },
);


exports.listarJogadoresTorneio =
onCall(
    CALL_OPTIONS,
    async (request) => {
      authOrThrow(request);

      const db = getFirestore();

      const context =
        await currentTournamentOrThrow(
            db,
            request.data?.tournamentId,
        );

      const snapshot =
        await context
            .tournamentRef
            .collection("players")
            .get();

      const isAdmin =
        request.auth.uid === ADMIN_UID;

      const players =
        await Promise.all(
            snapshot.docs.map(
                async (memberSnapshot) => {
                  const member =
                    memberSnapshot.data() ||
                    {};

                  const playerId =
                    safeId(
                        member.playerId ||
                        memberSnapshot.id,
                    );

                  const profileSnapshot =
                    await db
                        .collection("players")
                        .doc(playerId)
                        .get();

                  const profile =
                    profileSnapshot.exists ?
                      profileSnapshot.data() ||
                        {} :
                      {};

                  return {
                    id: playerId,
                    name:
                      safeString(
                          profile.name ||
                          member.nameSnapshot ||
                          "Jogador",
                          100,
                      ),
                    photoURL:
                      safeString(
                          profile.photoURL ||
                          member
                              .photoURLSnapshot,
                          2000,
                      ),
                    position:
                      profile.position ===
                        "goalkeeper" ?
                        "goalkeeper" :
                        "field",
                    teamId:
                      safeString(
                          member.teamId,
                          120,
                      ),
                    paymentStatus:
                      isAdmin ?
                        paymentStatus(
                            member
                                .paymentStatus,
                        ) :
                        "",
                  };
                },
            ),
        );

      players.sort(
          (a, b) =>
            a.name.localeCompare(
                b.name,
                "pt-BR",
                {
                  sensitivity: "base",
                },
            ),
      );

      const counts = {
        total: players.length,
        paid: 0,
        pending: 0,
        exempt: 0,
      };

      if (isAdmin) {
        players.forEach((player) => {
          if (
            player.paymentStatus ===
            "paid"
          ) {
            counts.paid += 1;
          } else if (
            player.paymentStatus ===
            "exempt"
          ) {
            counts.exempt += 1;
          } else {
            counts.pending += 1;
          }
        });
      }

      return {
        players,
        counts,
        registrationFee:
          registrationFee(
              context
                  .data
                  .registrationFee,
          ),
      };
    },
);


exports.adicionarJogadorTorneio =
onCall(
    CALL_OPTIONS,
    async (request) => {
      adminOrThrow(request);

      const db = getFirestore();

      const context =
        await currentTournamentOrThrow(
            db,
            request.data?.tournamentId,
        );

      const playerId =
        safeId(
            request.data?.playerId,
        );

      if (
        !playerId ||
        playerId === ADMIN_UID
      ) {
        throw new HttpsError(
            "invalid-argument",
            "Jogador inválido.",
        );
      }

      const profileSnapshot =
        await db
            .collection("players")
            .doc(playerId)
            .get();

      if (!profileSnapshot.exists) {
        throw new HttpsError(
            "not-found",
            "Jogador não encontrado.",
        );
      }

      const profile =
        profileSnapshot.data() ||
        {};

      const memberRef =
        context
            .tournamentRef
            .collection("players")
            .doc(playerId);

      const oldSnapshot =
        await memberRef.get();

      const patch = {
        playerId,
        nameSnapshot:
          safeString(
              profile.name ||
              profile.nickname ||
              "Jogador",
              100,
          ),
        photoURLSnapshot:
          safeString(
              profile.photoURL,
              2000,
          ),
        updatedBy:
          request.auth.uid,
        updatedAt:
          FieldValue.serverTimestamp(),
      };

      if (!oldSnapshot.exists) {
        patch.paymentStatus =
          "pending";

        patch.teamId = "";

        patch.addedBy =
          request.auth.uid;

        patch.addedAt =
          FieldValue.serverTimestamp();
      }

      await memberRef.set(
          patch,
          {merge: true},
      );

      return {
        ok: true,
        playerId,
      };
    },
);


exports.removerJogadorTorneio =
onCall(
    CALL_OPTIONS,
    async (request) => {
      adminOrThrow(request);

      const db = getFirestore();

      const context =
        await currentTournamentOrThrow(
            db,
            request.data?.tournamentId,
        );

      const playerId =
        safeId(
            request.data?.playerId,
        );

      if (!playerId) {
        throw new HttpsError(
            "invalid-argument",
            "Jogador inválido.",
        );
      }

      await context
          .tournamentRef
          .collection("players")
          .doc(playerId)
          .delete();

      return {
        ok: true,
        permanentProfilePreserved:
          true,
        rachaPreserved:
          true,
      };
    },
);


exports.definirPagamentoJogadorTorneio =
onCall(
    CALL_OPTIONS,
    async (request) => {
      adminOrThrow(request);

      const db = getFirestore();

      const context =
        await currentTournamentOrThrow(
            db,
            request.data?.tournamentId,
        );

      const playerId =
        safeId(
            request.data?.playerId,
        );

      if (!playerId) {
        throw new HttpsError(
            "invalid-argument",
            "Jogador inválido.",
        );
      }

      const status =
        paymentStatus(
            request.data?.status,
        );

      const ref =
        context
            .tournamentRef
            .collection("players")
            .doc(playerId);

      const snapshot =
        await ref.get();

      if (!snapshot.exists) {
        throw new HttpsError(
            "not-found",
            "Jogador não está no campeonato.",
        );
      }

      const patch = {
        paymentStatus: status,
        paymentUpdatedBy:
          request.auth.uid,
        paymentUpdatedAt:
          FieldValue.serverTimestamp(),
        updatedAt:
          FieldValue.serverTimestamp(),
      };

      if (status === "paid") {
        patch.paidAt =
          FieldValue.serverTimestamp();

        patch.exemptAt =
          FieldValue.delete();
      } else if (
        status === "exempt"
      ) {
        patch.exemptAt =
          FieldValue.serverTimestamp();

        patch.paidAt =
          FieldValue.delete();
      } else {
        patch.paidAt =
          FieldValue.delete();

        patch.exemptAt =
          FieldValue.delete();
      }

      await ref.set(
          patch,
          {merge: true},
      );

      return {
        ok: true,
        status,
      };
    },
);


exports.salvarTaxaInscricaoTorneio =
onCall(
    CALL_OPTIONS,
    async (request) => {
      adminOrThrow(request);

      const raw =
        Number(
            request.data
                ?.registrationFee,
        );

      if (
        !Number.isFinite(raw) ||
        raw < 0 ||
        raw > 10000
      ) {
        throw new HttpsError(
            "invalid-argument",
            "Valor da inscrição inválido.",
        );
      }

      const db = getFirestore();

      const context =
        await currentTournamentOrThrow(
            db,
            request.data?.tournamentId,
        );

      const amount =
        registrationFee(raw);

      await context
          .tournamentRef
          .set(
              {
                registrationFee:
                  amount,
                updatedBy:
                  request.auth.uid,
                updatedAt:
                  FieldValue
                      .serverTimestamp(),
              },
              {merge: true},
          );

      return {
        ok: true,
        registrationFee:
          amount,
      };
    },
);
