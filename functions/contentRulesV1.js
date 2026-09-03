"use strict";

const {
  onCall,
  HttpsError,
} = require(
    "firebase-functions/v2/https"
);

const {
  getFirestore,
  FieldValue,
} = require(
    "firebase-admin/firestore"
);


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

  if (
    request.auth.uid !==
    ADMIN_UID
  ) {
    throw new HttpsError(
        "permission-denied",
        "Apenas o administrador pode editar as regras.",
    );
  }
}


function cleanRules(value) {
  return String(value || "")
      .replace(/\r\n/g, "\n")
      .trim()
      .slice(0, 8000);
}


function rulesPayload(data = {}) {
  return {
    rachaRules:
      cleanRules(
          data.rachaRules,
      ),

    internalRules:
      cleanRules(
          data.internalRules,
      ),

    tournamentRules:
      cleanRules(
          data.tournamentRules,
      ),
  };
}


// GREEN PARK CONTENT RULES V1
exports.obterRegrasGreenPark =
  onCall(
      CALL_OPTIONS,
      async (request) => {
        authOrThrow(request);

        const db =
          getFirestore();

        const snapshot =
          await db
              .collection("app_content")
              .doc("rules")
              .get();

        if (!snapshot.exists) {
          return {
            exists: false,
            ...rulesPayload(),
          };
        }

        return {
          exists: true,
          ...rulesPayload(
              snapshot.data() || {},
          ),
        };
      },
  );


exports.salvarRegrasGreenPark =
  onCall(
      CALL_OPTIONS,
      async (request) => {
        adminOrThrow(request);

        const rules =
          rulesPayload(
              request.data || {},
          );

        const totalLength =
          rules.rachaRules.length +
          rules.internalRules.length +
          rules.tournamentRules.length;

        if (totalLength > 20000) {
          throw new HttpsError(
              "invalid-argument",
              "O regulamento ficou muito grande.",
          );
        }

        const db =
          getFirestore();

        await db
            .collection("app_content")
            .doc("rules")
            .set(
                {
                  ...rules,

                  updatedBy:
                    request.auth.uid,

                  updatedAt:
                    FieldValue
                        .serverTimestamp(),

                  version: 1,
                },
                {
                  merge: true,
                },
            );

        return {
          ok: true,
          ...rules,
        };
      },
  );
