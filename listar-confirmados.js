/*
 * Green Park FC - Tópico 4
 * Lista pública dos jogadores confirmados.
 *
 * Não retorna telefone, e-mail ou dados de pagamento.
 */

exports.listarConfirmados = onCall(
    {
      region: "southamerica-east1",
      timeoutSeconds: 15,
    },
    async (request) => {
      if (!request.auth) {
        throw new HttpsError(
            "unauthenticated",
            "É necessário estar autenticado.",
        );
      }

      const db = getFirestore();

      const snapshot =
        await db
            .collection("players")
            .where("status", "==", "confirmed")
            .get();

      const players =
        snapshot.docs.map((docSnap) => {
          const data = docSnap.data() || {};

          let confirmedAt = 0;

          if (
            data.confirmedAt &&
            typeof data.confirmedAt.toMillis === "function"
          ) {
            confirmedAt = data.confirmedAt.toMillis();
          }

          return {
            id: docSnap.id,
            name:
              String(data.name || "Jogador")
                  .trim()
                  .slice(0, 60),
            confirmedAt,
          };
        });

      players.sort((a, b) => {
        if (a.confirmedAt && b.confirmedAt) {
          return a.confirmedAt - b.confirmedAt;
        }

        if (a.confirmedAt) return -1;
        if (b.confirmedAt) return 1;

        return a.name.localeCompare(
            b.name,
            "pt-BR",
        );
      });

      return {
        count: players.length,
        players: players.slice(0, 100),
      };
    },
);
