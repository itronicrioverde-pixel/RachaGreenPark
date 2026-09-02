const {
  onDocumentCreated,
  onDocumentUpdated,
} = require("firebase-functions/v2/firestore");

const {initializeApp} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");
const {getStorage} = require("firebase-admin/storage");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const {getMessaging} = require("firebase-admin/messaging");

initializeApp();

const ADMIN_UID = "d3nVt6SbQlO6lYnOcCUDbLBhoU02";

const GREENPARK_APP_URL = "https://racha-95fca.web.app/";

function collectFcmTokens(data = {}) {
  const tokens = [];

  if (Array.isArray(data.fcmTokens)) {
    tokens.push(...data.fcmTokens);
  }

  if (data.fcmToken) {
    tokens.push(data.fcmToken);
  }

  return [...new Set(
      tokens
          .map((token) => String(token || "").trim())
          .filter(Boolean),
  )];
}

async function sendPushToTokens(tokens, payload) {
  const cleanTokens = [...new Set(
      (tokens || [])
          .map((token) => String(token || "").trim())
          .filter(Boolean),
  )];

  if (!cleanTokens.length) {
    return {successCount: 0, failureCount: 0};
  }

  if (cleanTokens.length === 1) {
    await getMessaging().send({
      token: cleanTokens[0],
      ...payload,
    });

    return {successCount: 1, failureCount: 0};
  }

  return getMessaging().sendEachForMulticast({
    tokens: cleanTokens,
    ...payload,
  });
}

async function claimPixPush(db, orderRef, claimField, sentField) {
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(orderRef);
    const data = snapshot.exists ? snapshot.data() || {} : {};

    if (data[sentField] || data[claimField]) {
      return false;
    }

    transaction.set(
        orderRef,
        {[claimField]: FieldValue.serverTimestamp()},
        {merge: true},
    );

    return true;
  });
}

async function finishPixPush(orderRef, claimField, sentField, ok) {
  const patch = {
    [claimField]: FieldValue.delete(),
  };

  if (ok) {
    patch[sentField] = FieldValue.serverTimestamp();
  }

  await orderRef.set(patch, {merge: true});
}

async function sendPixConfirmedPushes(
    db,
    {orderId, userId, playerData = {}, includeAdmin = true, includePlayer = true},
) {
  const orderRef = db.collection("pix_orders").doc(orderId);
  const orderSnapshot = await orderRef.get();
  const orderData = orderSnapshot.exists ? orderSnapshot.data() || {} : {};

  const amount = Number(orderData.amount || 0);
  const amountText = "R$ " + amount.toFixed(2).replace(".", ",");
  const typeLabel = orderData.type === "monthly" ? "Mensalidade" : "Diaria";
  const playerName = String(
      playerData.name || orderData.name || "Jogador",
  ).trim() || "Jogador";

  if (includeAdmin) {
    const adminSnapshot = await db.collection("players").doc(ADMIN_UID).get();
    const adminData = adminSnapshot.exists ?
      adminSnapshot.data() || {} : {};
    const adminTokens = collectFcmTokens(adminData);

    if (adminTokens.length) {
      const claimed = await claimPixPush(
          db,
          orderRef,
          "adminPushClaimedAt",
          "adminPushSentAt",
      );

      if (claimed) {
        let sent = false;
        try {
          const adminTitle = "Pix recebido";
          const adminBody = playerName + " - " + amountText + " - " + typeLabel;

          const pushResult = await sendPushToTokens(
              adminTokens,
              {
                notification: {
                  title: adminTitle,
                  body: adminBody,
                },
                data: {
                  title: adminTitle,
                  body: adminBody,
                  orderId: String(orderId),
                  userId: String(userId || ""),
                  url: GREENPARK_APP_URL,
                },
                webpush: {
                  headers: {
                    Urgency: "high",
                    TTL: "300",
                  },
                  fcmOptions: {link: GREENPARK_APP_URL},
                },
              },
          );

          sent = Number(pushResult.successCount || 0) > 0;

          console.log(
              "Push Pix admin enviado:",
              orderId,
              "sucessos=" + Number(pushResult.successCount || 0),
              "falhas=" + Number(pushResult.failureCount || 0),
          );
        } catch (error) {
          console.warn("Falha no Push Pix admin:", error.message);
        } finally {
          await finishPixPush(
              orderRef,
              "adminPushClaimedAt",
              "adminPushSentAt",
              sent,
          );
        }
      }
    } else {
      console.log("Admin sem token FCM ativo para Push:", orderId);
    }
  }

  if (includePlayer) {
    const playerTokens = collectFcmTokens(playerData);

    if (playerTokens.length) {
      const claimed = await claimPixPush(
          db,
          orderRef,
          "playerPushClaimedAt",
          "playerPushSentAt",
      );

      if (claimed) {
        let sent = false;
        try {
          const playerTitle = "Pagamento confirmado";
          const playerBody = "Seu Pix foi confirmado. Sua vaga no racha esta garantida.";

          const pushResult = await sendPushToTokens(
              playerTokens,
              {
                notification: {
                  title: playerTitle,
                  body: playerBody,
                },
                data: {
                  title: playerTitle,
                  body: playerBody,
                  orderId: String(orderId),
                  url: GREENPARK_APP_URL,
                },
                webpush: {
                  headers: {
                    Urgency: "high",
                    TTL: "300",
                  },
                  fcmOptions: {link: GREENPARK_APP_URL},
                },
              },
          );

          sent = Number(pushResult.successCount || 0) > 0;

          console.log(
              "Push Pix jogador enviado:",
              orderId,
              userId,
              "sucessos=" + Number(pushResult.successCount || 0),
              "falhas=" + Number(pushResult.failureCount || 0),
          );
        } catch (error) {
          console.warn("Falha no Push Pix jogador:", error.message);
        } finally {
          await finishPixPush(
              orderRef,
              "playerPushClaimedAt",
              "playerPushSentAt",
              sent,
          );
        }
      }
    }
  }
}

exports.novoPagamento = onDocumentCreated(
    {
      document: "payments/{paymentId}",
      region: "southamerica-east1",
    },
    async (event) => {
      const snapshot = event.data;

      if (!snapshot) {
        console.log("Pagamento sem dados");
        return null;
      }

      const payment = snapshot.data();
      const db = getFirestore();

      const adminSnapshot = await db
          .collection("players")
          .doc(ADMIN_UID)
          .get();

      if (!adminSnapshot.exists) {
        console.log("Administrador nao encontrado");
        return null;
      }

      const adminData = adminSnapshot.data();
      const token = adminData.fcmToken;

      if (!token) {
        console.log("Token FCM do administrador nao encontrado");
        return null;
      }

      const nome = payment.name || "Jogador";
      const valor = Number(payment.amount || 0);
      const valorTexto = "R$ " + valor.toFixed(2).replace(".", ",");
      const tipo = payment.type === "monthly" ? "Mensalidade" : "Diaria";

      const message = {
        token: token,
        data: {
          title: "Green Park FC",
          body:
            nome +
            " informou pagamento de " +
            valorTexto +
            " - " +
            tipo,
          paymentId: event.params.paymentId,
          url:
            "./?open=admin-payment&paymentId=" +
            event.params.paymentId,
        },
        webpush: {
          headers: {
            Urgency: "high",
          },
        },
      };

      const response = await getMessaging().send(message);

      console.log("Notificacao do admin enviada:", response);

      await snapshot.ref.update({
        notificationSentAt: FieldValue.serverTimestamp(),
      });

      return response;
    },
);

exports.pagamentoAtualizado = onDocumentUpdated(
    {
      document: "payments/{paymentId}",
      region: "southamerica-east1",
    },
    async (event) => {
      if (!event.data) {
        return null;
      }

      const before = event.data.before.data();
      const after = event.data.after.data();

      if (!before || !after) {
        return null;
      }

      if (before.status === after.status) {
        return null;
      }

      if (after.status !== "approved" && after.status !== "rejected") {
        return null;
      }

      const userId = after.userId;

      if (!userId) {
        console.log("Pagamento sem userId");
        return null;
      }

      const db = getFirestore();
      const playerRef = db.collection("players").doc(userId);
      const playerSnapshot = await playerRef.get();

      if (!playerSnapshot.exists) {
        console.log("Jogador nao encontrado:", userId);
        return null;
      }

      const nextStatus =
        after.status === "approved" ? "confirmed" : "rejected";

      await playerRef.set(
          {
            status: nextStatus,
            paymentStatus: after.status,
            updatedAt: FieldValue.serverTimestamp(),
          },
          {merge: true},
      );

      const playerData = playerSnapshot.data();
      const token = playerData.fcmToken;

      if (!token) {
        console.log(
            "Status atualizado, mas jogador nao ativou notificacoes:",
            userId,
        );
        return null;
      }

      const approved = after.status === "approved";

      const title = approved
        ? "Presenca confirmada"
        : "Pagamento nao confirmado";

      const body = approved
        ? "Pagamento confirmado. Voce esta confirmado no proximo racha."
        : "Seu pagamento foi recusado pelo administrador. Abra o Green Park para conferir.";

      const message = {
        token: token,
        data: {
          title: title,
          body: body,
          paymentId: event.params.paymentId,
          url: "./",
        },
        webpush: {
          headers: {
            Urgency: "high",
          },
        },
      };

      const response = await getMessaging().send(message);

      console.log("Notificacao do jogador enviada:", response);

      await event.data.after.ref.update({
        playerNotificationSentAt: FieldValue.serverTimestamp(),
      });

      return response;
    },
);
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const crypto = require("crypto");

const MERCADO_PAGO_ACCESS_TOKEN =
  defineSecret("MERCADO_PAGO_ACCESS_TOKEN");

function greenParkValidPayerEmail(rawValue) {
  const value = String(rawValue || "").trim().toLowerCase();

  if (
    !value ||
    value.length > 254 ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(value)
  ) {
    return false;
  }

  const at = value.lastIndexOf("@");
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);

  return !(
    !local ||
    local.length > 64 ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..") ||
    domain.includes("..")
  );
}

function greenParkPlayerHasPhoto(playerData = {}) {
  const photoURL =
    String(playerData.photoURL || "").trim();

  return (
    photoURL.startsWith("https://") ||
    photoURL.startsWith("http://")
  );
}


function greenParkRequirePlayerPhoto(playerData = {}) {
  if (!greenParkPlayerHasPhoto(playerData)) {
    throw new HttpsError(
        "failed-precondition",
        "Foto de perfil obrigatória. Adicione sua foto antes de entrar ou pagar o racha.",
    );
  }
}


exports.criarPagamentoPix = onCall(
    {
      region: "southamerica-east1",
      secrets: [MERCADO_PAGO_ACCESS_TOKEN],
    },
    async (request) => {
      if (!request.auth) {
        throw new HttpsError(
            "unauthenticated",
            "Jogador precisa estar conectado.",
        );
      }

      const data = request.data || {};
      const tipo = data.type;
      const email = String(data.email || "").trim().toLowerCase();

      if (tipo !== "daily" && tipo !== "monthly") {
        throw new HttpsError(
            "invalid-argument",
            "Tipo de pagamento inválido.",
        );
      }

      if (!greenParkValidPayerEmail(email)) {
        throw new HttpsError(
            "invalid-argument",
            "E-mail inválido. Corrija o e-mail do cadastro e tente novamente.",
        );
      }

      const valor = tipo === "monthly" ? 70 : 13;
      const valorTexto = valor.toFixed(2);

      const uid = request.auth.uid;


      // ERRO 1: goleiro nunca cria cobrança Pix.
      const goalkeeperGuardDb = getFirestore();
      const goalkeeperPlayerSnapshot = await goalkeeperGuardDb
          .collection("players")
          .doc(uid)
          .get();
      const goalkeeperPlayerData = goalkeeperPlayerSnapshot.exists ?
        goalkeeperPlayerSnapshot.data() || {} : {};

      greenParkRequirePlayerPhoto(
          goalkeeperPlayerData,
      );

      if (goalkeeperPlayerData.position === "goalkeeper") {
        const goalkeeperResult = await greenParkApplyPlayerPosition({
          db: goalkeeperGuardDb,
          playerId: uid,
          position: "goalkeeper",
        });

        if (goalkeeperResult.goalkeeperConfirmed === true) {
          throw new HttpsError(
              "failed-precondition",
              "Goleiro não precisa pagar. Sua vaga já foi confirmada sem cobrança.",
          );
        }
      }

      // PACOTE 18B:
      // Sem lista de espera: lotado nao cria nova cobranca.
      const capacityDb = getFirestore();

      const [
        currentRachaSnapshot,
        confirmedPlayersSnapshot,
      ] = await Promise.all([
        capacityDb
            .collection("racha")
            .doc("current")
            .get(),
        capacityDb
            .collection("players")
            .where("status", "==", "confirmed")
            .get(),
      ]);

      const currentRachaData =
        currentRachaSnapshot.exists ?
          currentRachaSnapshot.data() || {} :
          {};

      const maxPlayers =
        Math.max(
            1,
            Number(currentRachaData.maxPlayers) || 40,
        );

      if (
        confirmedPlayersSnapshot.size >=
        maxPlayers
      ) {
        throw new HttpsError(
            "resource-exhausted",
            "Racha lotado. No momento não há vagas disponíveis.",
        );
      }

      const externalReference =
        "greenpark_" + uid.substring(0, 20) + "_" + Date.now();

      const body = {
        type: "online",
        total_amount: valorTexto,
        external_reference: externalReference,
        processing_mode: "automatic",
        transactions: {
          payments: [
            {
              amount: valorTexto,
              payment_method: {
                id: "pix",
                type: "bank_transfer",
              },
              expiration_time: "PT30M",
            },
          ],
        },
        payer: {
          email: email,
        },
      };

      const response = await fetch(
          "https://api.mercadopago.com/v1/orders",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization":
                "Bearer " + MERCADO_PAGO_ACCESS_TOKEN.value(),
              "X-Idempotency-Key": crypto.randomUUID(),
            },
            body: JSON.stringify(body),
          },
      );

      const order = await response.json();

      if (!response.ok) {
        console.error(
            "Erro Mercado Pago:",
            response.status,
            JSON.stringify(order),
        );

        const mercadoPagoErrorText =
          JSON.stringify(order || {});

        if (
          response.status === 400 &&
          (
            mercadoPagoErrorText.includes("$.payer.email") ||
            mercadoPagoErrorText.includes("payer.email")
          )
        ) {
          throw new HttpsError(
              "invalid-argument",
              "E-mail inválido. Corrija o e-mail do cadastro e tente novamente.",
          );
        }

        throw new HttpsError(
            "internal",
            "Não foi possível gerar o Pix.",
        );
      }

      const payment =
        order.transactions &&
        order.transactions.payments &&
        order.transactions.payments[0];

      const paymentMethod =
        payment && payment.payment_method ?
          payment.payment_method :
          {};

        // Salva a cobrança real para consulta automática e webhook.
  const db = getFirestore();
  const playerSnapshot = await db.collection("players").doc(uid).get();
  const playerData = playerSnapshot.exists ? playerSnapshot.data() || {} : {};

  await db
    .collection("pix_orders")
    .doc(order.id)
    .set({
      orderId: order.id,
      paymentId: payment ? (payment.id || "") : "",
      userId: uid,
      name: String(playerData.name || "Jogador"),
      email: email,
      type: tipo,
      amount: valor,
      status: order.status || "",
      statusDetail: order.status_detail || "",
      externalReference: externalReference,
      testMode: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }, { merge: true });

  // Vincula a cobrança pendente ao jogador.
  await db
    .collection("players")
    .doc(uid)
    .set({
      paymentType: tipo,
      pixOrderId: order.id,
      pixStatus: order.status || "created",
      pixProvider: "mercadopago_pix",
      updatedAt: new Date(),
    }, { merge: true });

  console.log(
    "Pix salvo no Firestore:",
    order.id,
    "user:",
    uid,
    "valor:",
    valor
  );

return {
        success: true,
        orderId: order.id || "",
        paymentId: payment ? payment.id || "" : "",
        amount: valor,
        type: tipo,
        status: order.status || "",
        qrCode: paymentMethod.qr_code || "",
        qrCodeBase64: paymentMethod.qr_code_base64 || "",
        ticketUrl: paymentMethod.ticket_url || "",
      };
    },
);
exports.consultarPagamentoPix = onCall(
    {
      region: "southamerica-east1",
      secrets: [MERCADO_PAGO_ACCESS_TOKEN],
    },
    async (request) => {
      if (!request.auth) {
        throw new HttpsError(
            "unauthenticated",
            "Jogador precisa estar conectado.",
        );
      }

      const orderId = String(request.data?.orderId || "").trim();

      if (!orderId) {
        throw new HttpsError(
            "invalid-argument",
            "Order ID não informado.",
        );
      }

      const response = await fetch(
          "https://api.mercadopago.com/v1/orders/" +
            encodeURIComponent(orderId),
          {
            method: "GET",
            headers: {
              "accept": "application/json",
              "Authorization":
                "Bearer " + MERCADO_PAGO_ACCESS_TOKEN.value(),
            },
          },
      );

      const order = await response.json();

      if (!response.ok) {
        console.error(
            "Erro consultando Pix:",
            response.status,
            JSON.stringify(order),
        );

        throw new HttpsError(
            "internal",
            "Não foi possível consultar o pagamento.",
        );
      }

      const uid = request.auth.uid;

      const expectedReference =
        "greenpark_" + uid.substring(0, 20) + "_";

      if (
        !order.external_reference ||
        !order.external_reference.startsWith(expectedReference)
      ) {
        throw new HttpsError(
            "permission-denied",
            "Este pagamento não pertence a este jogador.",
        );
      }

      const payment =
        order.transactions?.payments?.[0] || {};

      const paid =
        (
          order.status === "processed" &&
          order.status_detail === "accredited"
        ) ||
        (
          payment.status === "processed" &&
          payment.status_detail === "accredited"
        );

      if (!paid) {
        return {
          paid: false,
          orderId: order.id || orderId,
          status: order.status || "",
          statusDetail: order.status_detail || "",
          paymentStatus: payment.status || "",
          paymentStatusDetail: payment.status_detail || "",
        };
      }

      const db = getFirestore();

      const pixOrderRef = db.collection("pix_orders").doc(orderId);
      const pixSavedSnapshot = await pixOrderRef.get();
      const pixSavedData = pixSavedSnapshot.exists ?
        pixSavedSnapshot.data() || {} : {};
      const paidType = pixSavedData.type === "monthly" ? "monthly" : "daily";

      const playerRef =
        db.collection("players").doc(uid);

      const playerSnapshot = await playerRef.get();

      const playerData =
        playerSnapshot.exists ?
          playerSnapshot.data() :
          {};

      const updateData = {
        status: "confirmed",
        paymentStatus: "approved",
        paymentProvider: "mercadopago",
        paymentOrderId: orderId,
        paymentType: paidType,
        attendanceType: paidType,
        updatedAt: FieldValue.serverTimestamp(),
      };

      // Pix mensal ativa o plano do jogador no mês corrente.
      // Diária não derruba um plano mensal que já esteja ativo.
      if (paidType === "monthly") {
        updateData.billingType = "monthly";
        updateData.monthlyPaidThrough = financeSaoPauloParts().monthKey;
      }

      if (playerData.status !== "confirmed") {
        updateData.confirmedAt =
          FieldValue.serverTimestamp();
      }

      await playerRef.set(
          updateData,
          {merge: true},
      );

      await atualizarContagemRacha(db);

      await pixOrderRef.set(
          {
            status: "processed",
            statusDetail: "accredited",
            paid: true,
            confirmed: true,
            approvedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            name: String(playerData.name || "Jogador"),
          },
          {merge: true},
      );

      try {
        await sendPixConfirmedPushes(db, {
          orderId,
          userId: uid,
          playerData,
          includeAdmin: true,
          includePlayer: true,
        });
      } catch (pushError) {
        console.warn(
            "Pagamento confirmado, mas Push falhou:",
            pushError.message,
        );
      }

      return {
        paid: true,
        confirmed: true,
        orderId: order.id || orderId,
        status: order.status,
        statusDetail: order.status_detail,
      };
    },
);
exports.criarPagamentoPixTeste = onCall(
    {
      region: "southamerica-east1",
      secrets: [MERCADO_PAGO_ACCESS_TOKEN],
    },
    async (request) => {
      if (!request.auth) {
        throw new HttpsError(
            "unauthenticated",
            "Jogador precisa estar conectado.",
        );
      }

      const tipo = request.data?.type;

      if (tipo !== "daily" && tipo !== "monthly") {
        throw new HttpsError(
            "invalid-argument",
            "Tipo de pagamento inválido.",
        );
      }

      const uid = request.auth.uid;

      const externalReference =
        "greenpark_" + uid.substring(0, 20) + "_" + Date.now();

      const body = {
        type: "online",
        total_amount: "50.00",
        external_reference: externalReference,
        processing_mode: "automatic",

        payer: {
          email: "test_user_br@testuser.com",
          first_name: "APRO",
        },

        transactions: {
          payments: [
            {
              amount: "50.00",
              payment_method: {
                id: "pix",
                type: "bank_transfer",
              },
            },
          ],
        },
      };

      const response = await fetch(
          "https://api.mercadopago.com/v1/orders",
          {
            method: "POST",
            headers: {
              "accept": "application/json",
              "Content-Type": "application/json",
              "Authorization":
                "Bearer " + MERCADO_PAGO_ACCESS_TOKEN.value(),
              "X-Idempotency-Key": crypto.randomUUID(),
            },
            body: JSON.stringify(body),
          },
      );

      const order = await response.json();

      if (!response.ok) {
        console.error(
            "Erro teste Mercado Pago:",
            response.status,
            JSON.stringify(order),
        );

        throw new HttpsError(
            "internal",
            "Não foi possível gerar o Pix de teste.",
        );
      }

      const payment =
        order.transactions?.payments?.[0] || {};

      const paymentMethod =
        payment.payment_method || {};

      if (!order.id || !paymentMethod.qr_code) {
        console.error(
            "Order de teste sem QR Code:",
            JSON.stringify(order),
        );

        throw new HttpsError(
            "internal",
            "O Mercado Pago não retornou o Pix de teste.",
        );
      }

      const db = getFirestore();

      await db
          .collection("pix_orders")
          .doc(order.id)
          .set({
            orderId: order.id,
            paymentId: payment.id || "",
            userId: uid,
            type: tipo,
            amount: 50,
            testMode: true,
            status: order.status || "",
            statusDetail: order.status_detail || "",
            externalReference: externalReference,
            createdAt: FieldValue.serverTimestamp(),
          });

      return {
        success: true,
        testMode: true,
        orderId: order.id,
        paymentId: payment.id || "",
        amount: 50,
        type: tipo,
        status: order.status || "",
        statusDetail: order.status_detail || "",
        qrCode: paymentMethod.qr_code || "",
        qrCodeBase64: paymentMethod.qr_code_base64 || "",
        ticketUrl: paymentMethod.ticket_url || "",
      };
    },
);
const MERCADO_PAGO_QR_ACCESS_TOKEN =
  defineSecret("MERCADO_PAGO_QR_ACCESS_TOKEN");

const GREEN_PARK_POS_ID = "GREENPARKPOS001";


exports.criarPagamentoQr = onCall(
    {
      region: "southamerica-east1",
      secrets: [MERCADO_PAGO_QR_ACCESS_TOKEN],
    },
    async (request) => {
      if (!request.auth) {
        throw new HttpsError(
            "unauthenticated",
            "Jogador precisa estar conectado.",
        );
      }

      const tipo = request.data?.type;

      if (tipo !== "daily" && tipo !== "monthly") {
        throw new HttpsError(
            "invalid-argument",
            "Tipo de pagamento inválido.",
        );
      }

      const valor = tipo === "monthly" ? 70 : 15;
      const valorTexto = valor.toFixed(2);

      const externalReference =
        "greenpark_" +
        Date.now() +
        "_" +
        crypto.randomUUID().replace(/-/g, "").slice(0, 12);

      const body = {
        type: "qr",
        total_amount: valorTexto,
        description:
          tipo === "monthly" ?
            "Mensalidade Green Park" :
            "Diaria Green Park",
        external_reference: externalReference,
        expiration_time: "PT30M",

        config: {
          qr: {
            external_pos_id: GREEN_PARK_POS_ID,
            mode: "dynamic",
          },
        },

        transactions: {
          payments: [
            {
              amount: valorTexto,
            },
          ],
        },
      };

      const response = await fetch(
          "https://api.mercadopago.com/v1/orders",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization":
                "Bearer " +
                MERCADO_PAGO_QR_ACCESS_TOKEN.value(),
              "X-Idempotency-Key": crypto.randomUUID(),
            },
            body: JSON.stringify(body),
          },
      );

      let order;

      try {
        order = await response.json();
      } catch (error) {
        console.error(
            "Resposta inválida do Mercado Pago:",
            error,
        );

        throw new HttpsError(
            "internal",
            "Não foi possível gerar o Pix.",
        );
      }

      if (!response.ok) {
        console.error(
            "Erro Mercado Pago QR:",
            response.status,
            JSON.stringify(order),
        );

        throw new HttpsError(
            "internal",
            "Mercado Pago não conseguiu gerar o Pix.",
        );
      }

      const qrData =
        order.type_response?.qr_data || "";

      const payment =
        order.transactions?.payments?.[0] || {};

      if (!order.id || !qrData) {
        console.error(
            "Order criada sem QR:",
            JSON.stringify(order),
        );

        throw new HttpsError(
            "internal",
            "O Mercado Pago não retornou o QR do pagamento.",
        );
      }

      const db = getFirestore();
      const uid = request.auth.uid;

      await db
          .collection("pix_orders")
          .doc(order.id)
          .set({
            orderId: order.id,
            paymentId: payment.id || "",
            userId: uid,
            type: tipo,
            amount: valor,
            provider: "mercadopago_qr",
            externalReference: externalReference,
            status: order.status || "created",
            statusDetail: order.status_detail || "created",
            createdAt: FieldValue.serverTimestamp(),
          });

      await db
          .collection("players")
          .doc(uid)
          .set(
              {
                paymentType: tipo,
                paymentStatus: "waiting",
                paymentOrderId: order.id,
                updatedAt: FieldValue.serverTimestamp(),
              },
              {merge: true},
          );

      return {
        success: true,
        orderId: order.id,
        paymentId: payment.id || "",
        amount: valor,
        type: tipo,
        qrData: qrData,
        status: order.status || "created",
        statusDetail:
          order.status_detail || "created",
      };
    },
);


exports.consultarPagamentoQr = onCall(
    {
      region: "southamerica-east1",
      secrets: [MERCADO_PAGO_QR_ACCESS_TOKEN],
    },
    async (request) => {
      if (!request.auth) {
        throw new HttpsError(
            "unauthenticated",
            "Jogador precisa estar conectado.",
        );
      }

      const orderId =
        String(request.data?.orderId || "").trim();

      if (!orderId) {
        throw new HttpsError(
            "invalid-argument",
            "Order ID não informado.",
        );
      }

      const db = getFirestore();
      const uid = request.auth.uid;

      const savedOrder =
        await db
            .collection("pix_orders")
            .doc(orderId)
            .get();

      if (!savedOrder.exists) {
        throw new HttpsError(
            "not-found",
            "Pagamento não encontrado.",
        );
      }

      const savedData = savedOrder.data();

      if (savedData.userId !== uid) {
        throw new HttpsError(
            "permission-denied",
            "Este pagamento pertence a outro jogador.",
        );
      }

      const response = await fetch(
          "https://api.mercadopago.com/v1/orders/" +
            encodeURIComponent(orderId),
          {
            method: "GET",
            headers: {
              "Authorization":
                "Bearer " +
                MERCADO_PAGO_QR_ACCESS_TOKEN.value(),
            },
          },
      );

      const order = await response.json();

      if (!response.ok) {
        console.error(
            "Erro consultando QR:",
            response.status,
            JSON.stringify(order),
        );

        throw new HttpsError(
            "internal",
            "Não foi possível consultar o pagamento.",
        );
      }

      const paid =
        order.status === "processed" &&
        order.status_detail === "accredited";

      await savedOrder.ref.set(
          {
            status: order.status || "",
            statusDetail:
              order.status_detail || "",
            checkedAt:
              FieldValue.serverTimestamp(),
          },
          {merge: true},
      );

      if (!paid) {
        return {
          paid: false,
          orderId: orderId,
          status: order.status || "",
          statusDetail:
            order.status_detail || "",
        };
      }

      const playerRef =
        db.collection("players").doc(uid);

      await playerRef.set(
          {
            status: "confirmed",
            paymentStatus: "approved",
            paymentProvider:
              "mercadopago_qr",
            paymentOrderId: orderId,
            confirmedAt:
              FieldValue.serverTimestamp(),
            updatedAt:
              FieldValue.serverTimestamp(),
          },
          {merge: true},
      );

      await savedOrder.ref.set(
          {
            confirmed: true,
            confirmedAt:
              FieldValue.serverTimestamp(),
          },
          {merge: true},
      );

      await atualizarContagemRacha(db);

      return {
        paid: true,
        confirmed: true,
        orderId: orderId,
        status: order.status,
        statusDetail:
          order.status_detail,
      };
    },
);
async function atualizarContagemRacha(db) {
  const confirmedSnapshot = await db
      .collection("players")
      .where("status", "==", "confirmed")
      .get();

  const confirmedCount = confirmedSnapshot.size;

  await db
      .collection("racha")
      .doc("current")
      .set(
          {
            confirmedCount: confirmedCount,
            countUpdatedAt: FieldValue.serverTimestamp(),
          },
          {merge: true},
      );

  console.log("Contagem oficial atualizada:", confirmedCount);

  return confirmedCount;
}
const {onRequest} = require("firebase-functions/v2/https");


const mercadoPagoWebhookLegacyP16_1 = onRequest(
    {
      region: "southamerica-east1",
      secrets: [MERCADO_PAGO_ACCESS_TOKEN],
      timeoutSeconds: 30,
    },
    async (req, res) => {
      if (req.method !== "POST") {
        return res.status(200).send("ok");
      }

      const body = req.body || {};

      const orderId =
        String(body?.data?.id || "").trim();

      console.log(
          "Webhook Mercado Pago:",
          body.action || "",
          orderId,
      );

      if (!orderId) {
        return res.status(200).send("ok");
      }

      try {
        /*
         * Nunca confiamos apenas no webhook.
         * Consultamos o Mercado Pago para confirmar
         * o status real da order.
         */
        const response = await fetch(
            "https://api.mercadopago.com/v1/orders/" +
              encodeURIComponent(orderId),
            {
              method: "GET",
              headers: {
                "Authorization":
                  "Bearer " +
                  MERCADO_PAGO_ACCESS_TOKEN.value(),
                "accept": "application/json",
              },
            },
        );

        const order = await response.json();

        if (!response.ok) {
          console.error(
              "Erro consultando order:",
              response.status,
              JSON.stringify(order),
          );

          return res.status(500).send("erro");
        }

        const paid =
          order.status === "processed" &&
          order.status_detail === "accredited";

        /*
         * Se ainda não foi pago, apenas recebemos
         * a notificação e aguardamos a próxima.
         */
        if (!paid) {
          console.log(
              "Order ainda pendente:",
              order.status,
              order.status_detail,
          );

          return res.status(200).send("ok");
        }

        const db = getFirestore();

        /*
         * Só aceitamos orders que foram criadas
         * pelo próprio Green Park.
         */
        const savedOrder =
          await db
              .collection("pix_orders")
              .doc(orderId)
              .get();

        if (!savedOrder.exists) {
          console.log(
              "Order não pertence ao Green Park:",
              orderId,
          );

          return res.status(200).send("ok");
        }

        const savedData = savedOrder.data();

        /*
         * Evita executar duas vezes caso o
         * Mercado Pago repita o webhook.
         */
        if (savedData.webhookConfirmed === true) {
          console.log(
              "Order já processada pelo webhook:",
              orderId,
          );

          return res.status(200).send("ok");
        }

        const userId = savedData.userId;

        if (!userId) {
          console.error(
              "Order sem userId:",
              orderId,
          );

          return res.status(200).send("ok");
        }

        const playerRef =
          db.collection("players").doc(userId);

        const playerSnapshot =
          await playerRef.get();

        const playerData =
          playerSnapshot.exists ?
            playerSnapshot.data() :
            {};

        await playerRef.set(
            {
              status: "confirmed",
              paymentStatus: "approved",
              paymentProvider: "mercadopago",
              paymentOrderId: orderId,
              confirmedAt:
                playerData.status === "confirmed" ?
                  playerData.confirmedAt ||
                    FieldValue.serverTimestamp() :
                  FieldValue.serverTimestamp(),
              updatedAt:
                FieldValue.serverTimestamp(),
            },
            {merge: true},
        );

        await savedOrder.ref.set(
            {
              status: "processed",
              statusDetail: "accredited",
              confirmed: true,
              webhookConfirmed: true,
              webhookConfirmedAt:
                FieldValue.serverTimestamp(),
            },
            {merge: true},
        );

        /*
         * Atualiza Confirmados/Vagas da Home.
         */
        await atualizarContagemRacha(db);

        /*
         * Se o jogador ativou notificações,
         * também avisamos o telefone.
         */
        if (playerData.fcmToken) {
          try {
            await getMessaging().send({
              token: playerData.fcmToken,
              data: {
                title: "Pagamento confirmado",
                body:
                  "Seu Pix foi confirmado. " +
                  "Sua vaga no racha está garantida.",
                url: "./",
              },
              webpush: {
                headers: {
                  Urgency: "high",
                },
              },
            });
          } catch (notificationError) {
            console.warn(
                "Pagamento confirmado, " +
                "mas push não foi enviado:",
                notificationError,
            );
          }
        }

        console.log(
            "Pagamento confirmado via webhook:",
            orderId,
            userId,
        );

        return res.status(200).send("ok");
      } catch (error) {
        console.error(
            "Erro no webhook Mercado Pago:",
            error,
        );

        return res.status(500).send("erro");
      }
    },
);


const mercadoPagoWebhookLegacyP16_2 = onRequest(
    {
      region: "southamerica-east1",
      secrets: [MERCADO_PAGO_ACCESS_TOKEN],
      timeoutSeconds: 30,
    },
    async (req, res) => {
      if (req.method !== "POST") {
        return res.status(200).send("ok");
      }

      const body = req.body || {};

      const orderId =
        String(body?.data?.id || "").trim();

      console.log(
          "Webhook Mercado Pago:",
          body.action || "",
          orderId,
      );

      if (!orderId) {
        return res.status(200).send("ok");
      }

      try {
        /*
         * Nunca confiamos apenas no webhook.
         * Consultamos o Mercado Pago para confirmar
         * o status real da order.
         */
        const response = await fetch(
            "https://api.mercadopago.com/v1/orders/" +
              encodeURIComponent(orderId),
            {
              method: "GET",
              headers: {
                "Authorization":
                  "Bearer " +
                  MERCADO_PAGO_ACCESS_TOKEN.value(),
                "accept": "application/json",
              },
            },
        );

        const order = await response.json();

        if (!response.ok) {
          console.error(
              "Erro consultando order:",
              response.status,
              JSON.stringify(order),
          );

          return res.status(500).send("erro");
        }

        const paid =
          order.status === "processed" &&
          order.status_detail === "accredited";

        /*
         * Se ainda não foi pago, apenas recebemos
         * a notificação e aguardamos a próxima.
         */
        if (!paid) {
          console.log(
              "Order ainda pendente:",
              order.status,
              order.status_detail,
          );

          return res.status(200).send("ok");
        }

        const db = getFirestore();

        /*
         * Só aceitamos orders que foram criadas
         * pelo próprio Green Park.
         */
        const savedOrder =
          await db
              .collection("pix_orders")
              .doc(orderId)
              .get();

        if (!savedOrder.exists) {
          console.log(
              "Order não pertence ao Green Park:",
              orderId,
          );

          return res.status(200).send("ok");
        }

        const savedData = savedOrder.data();

        /*
         * Evita executar duas vezes caso o
         * Mercado Pago repita o webhook.
         */
        if (savedData.webhookConfirmed === true) {
          console.log(
              "Order já processada pelo webhook:",
              orderId,
          );

          return res.status(200).send("ok");
        }

        const userId = savedData.userId;

        if (!userId) {
          console.error(
              "Order sem userId:",
              orderId,
          );

          return res.status(200).send("ok");
        }

        const playerRef =
          db.collection("players").doc(userId);

        const playerSnapshot =
          await playerRef.get();

        const playerData =
          playerSnapshot.exists ?
            playerSnapshot.data() :
            {};

        await playerRef.set(
            {
              status: "confirmed",
              paymentStatus: "approved",
              paymentProvider: "mercadopago",
              paymentOrderId: orderId,
              confirmedAt:
                playerData.status === "confirmed" ?
                  playerData.confirmedAt ||
                    FieldValue.serverTimestamp() :
                  FieldValue.serverTimestamp(),
              updatedAt:
                FieldValue.serverTimestamp(),
            },
            {merge: true},
        );

        await savedOrder.ref.set(
            {
              status: "processed",
              statusDetail: "accredited",
              confirmed: true,
              webhookConfirmed: true,
              webhookConfirmedAt:
                FieldValue.serverTimestamp(),
            },
            {merge: true},
        );

        /*
         * Atualiza Confirmados/Vagas da Home.
         */
        await atualizarContagemRacha(db);

        /*
         * Se o jogador ativou notificações,
         * também avisamos o telefone.
         */
        if (playerData.fcmToken) {
          try {
            await getMessaging().send({
              token: playerData.fcmToken,
              data: {
                title: "Pagamento confirmado",
                body:
                  "Seu Pix foi confirmado. " +
                  "Sua vaga no racha está garantida.",
                url: "./",
              },
              webpush: {
                headers: {
                  Urgency: "high",
                },
              },
            });
          } catch (notificationError) {
            console.warn(
                "Pagamento confirmado, " +
                "mas push não foi enviado:",
                notificationError,
            );
          }
        }

        console.log(
            "Pagamento confirmado via webhook:",
            orderId,
            userId,
        );

        return res.status(200).send("ok");
      } catch (error) {
        console.error(
            "Erro no webhook Mercado Pago:",
            error,
        );

        return res.status(500).send("erro");
      }
    },
);
const MERCADO_PAGO_WEBHOOK_SECRET_V2 =
  require("firebase-functions/params")
      .defineSecret("MERCADO_PAGO_WEBHOOK_SECRET");


function validarAssinaturaMercadoPagoV2(req) {
  const crypto = require("crypto");

  const xSignature =
    String(req.headers["x-signature"] || "");

  const xRequestId =
    String(req.headers["x-request-id"] || "");

  if (!xSignature) {
    return false;
  }

  let ts = "";
  let v1 = "";

  for (const part of xSignature.split(",")) {
    const [key, ...rest] = part.split("=");
    const value = rest.join("=").trim();

    if (key.trim() === "ts") {
      ts = value;
    }

    if (key.trim() === "v1") {
      v1 = value;
    }
  }

  if (!ts || !v1) {
    return false;
  }

  /*
   * O Mercado Pago usa data.id da URL para
   * montar a assinatura.
   */
  let dataId =
    String(req.query["data.id"] || "").trim();

  /*
   * IDs alfanuméricos devem ser minúsculos
   * para validação da assinatura.
   */
  if (dataId && /[a-zA-Z]/.test(dataId)) {
    dataId = dataId.toLowerCase();
  }

  let manifest = "";

  if (dataId) {
    manifest += `id:${dataId};`;
  }

  if (xRequestId) {
    manifest += `request-id:${xRequestId};`;
  }

  manifest += `ts:${ts};`;

  const secret =
    MERCADO_PAGO_WEBHOOK_SECRET_V2.value();

  const calculated =
    crypto
        .createHmac("sha256", secret)
        .update(manifest)
        .digest("hex");

  if (
    !/^[a-f0-9]{64}$/i.test(v1) ||
    calculated.length !== v1.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
      Buffer.from(calculated, "hex"),
      Buffer.from(v1, "hex"),
  );
}


const mercadoPagoWebhookLegacyP16_3 = onRequest(
    {
      region: "southamerica-east1",
      secrets: [
        MERCADO_PAGO_ACCESS_TOKEN,
        MERCADO_PAGO_WEBHOOK_SECRET_V2,
      ],
      timeoutSeconds: 30,
    },
    async (req, res) => {
      if (req.method !== "POST") {
        return res.status(200).send("ok");
      }

      /*
       * Primeiro: prova que a chamada veio
       * realmente do Mercado Pago.
       */
      if (!validarAssinaturaMercadoPagoV2(req)) {
        console.warn(
            "Webhook rejeitado: assinatura inválida.",
        );

        return res
            .status(401)
            .send("assinatura invalida");
      }

      const body = req.body || {};

      const orderId =
        String(
            body?.data?.id ||
            req.query["data.id"] ||
            "",
        ).trim();

      console.log(
          "Webhook Mercado Pago validado:",
          body.action || "",
          orderId,
      );

      if (!orderId) {
        return res.status(200).send("ok");
      }

      try {
        /*
         * Mesmo com assinatura válida,
         * consultamos a API do Mercado Pago.
         * O body sozinho nunca confirma pagamento.
         */
        const response = await fetch(
            "https://api.mercadopago.com/v1/orders/" +
            encodeURIComponent(orderId),
            {
              method: "GET",
              headers: {
                "Authorization":
                  "Bearer " +
                  MERCADO_PAGO_ACCESS_TOKEN.value(),
                "accept": "application/json",
              },
            },
        );

        const order = await response.json();

        if (!response.ok) {
          console.error(
              "Erro consultando order:",
              response.status,
              JSON.stringify(order),
          );

          /*
           * 200 evita ficar repetindo indefinidamente
           * uma notificação de teste sem order real.
           */
          return res.status(200).send("ok");
        }

        const payment =
          Array.isArray(order.transactions?.payments) ?
            order.transactions.payments[0] || {} :
            {};

        const paid =
          (
            order.status === "processed" &&
            order.status_detail === "accredited"
          ) ||
          (
            payment.status === "processed" &&
            payment.status_detail === "accredited"
          );

        if (!paid) {
          console.log(
              "Order ainda não aprovada:",
              order.status,
              order.status_detail,
              payment.status || "",
              payment.status_detail || "",
          );

          return res.status(200).send("ok");
        }

        const db = getFirestore();

        /*
         * Confere se essa cobrança foi realmente
         * criada pelo nosso aplicativo.
         */
        const savedOrder =
          await db
              .collection("pix_orders")
              .doc(orderId)
              .get();

        if (!savedOrder.exists) {
          console.warn(
              "Order não encontrada em pix_orders:",
              orderId,
          );

          return res.status(200).send("ok");
        }

        const savedData =
          savedOrder.data() || {};

        const userId =
          String(savedData.userId || "");

        if (!userId) {
          console.error(
              "Order sem userId:",
              orderId,
          );

          return res.status(200).send("ok");
        }

        /*
         * Se o webhook for repetido pelo Mercado
         * Pago, não processamos o pagamento duas vezes.
         */
        if (savedData.webhookConfirmed === true) {
          console.log(
              "Webhook já processado:",
              orderId,
          );

          return res.status(200).send("ok");
        }

        const playerRef =
          db.collection("players").doc(userId);

        const playerSnapshot =
          await playerRef.get();

        const playerData =
          playerSnapshot.exists ?
            playerSnapshot.data() || {} :
            {};

        const now =
          FieldValue.serverTimestamp();

        await playerRef.set(
            {
              status: "confirmed",
              paymentStatus: "approved",
              paymentProvider: "mercadopago",
              paymentOrderId: orderId,
              confirmedAt:
                playerData.confirmedAt || now,
              updatedAt: now,
            },
            {merge: true},
        );

        await savedOrder.ref.set(
            {
              status: "processed",
              statusDetail: "accredited",
              confirmed: true,
              webhookConfirmed: true,
              webhookConfirmedAt:
                FieldValue.serverTimestamp(),
            },
            {merge: true},
        );

        /*
         * Atualiza imediatamente o contador
         * oficial da Home.
         */
        await atualizarContagemRacha(db);

        /*
         * Push é complementar.
         * O Firestore já atualiza o app aberto
         * em tempo real.
         */
        if (playerData.fcmToken) {
          try {
            await getMessaging().send({
              token: playerData.fcmToken,
              notification: {
                title: "Pagamento confirmado",
                body:
                  "Seu Pix foi confirmado. " +
                  "Sua vaga está garantida.",
              },
              webpush: {
                headers: {
                  Urgency: "high",
                },
              },
            });
          } catch (notificationError) {
            console.warn(
                "Pagamento confirmado, " +
                "mas push falhou:",
                notificationError.message,
            );
          }
        }

        console.log(
            "PAGAMENTO CONFIRMADO VIA WEBHOOK:",
            orderId,
            userId,
        );

        return res.status(200).send("ok");
      } catch (error) {
        console.error(
            "Erro webhook Mercado Pago:",
            error,
        );

        return res.status(500).send("erro");
      }
    },
);
const MERCADO_PAGO_WEBHOOK_SECRET_V3 =
  require("firebase-functions/params")
      .defineSecret("MERCADO_PAGO_WEBHOOK_SECRET");


function validarAssinaturaMercadoPagoV3(req) {
  const crypto = require("crypto");

  const xSignature =
    String(req.headers["x-signature"] || "").trim();

  const xRequestId =
    String(req.headers["x-request-id"] || "").trim();

  if (!xSignature) {
    console.warn("Webhook sem x-signature");
    return false;
  }

  let ts = "";
  let v1 = "";

  for (const part of xSignature.split(",")) {
    const pos = part.indexOf("=");

    if (pos === -1) continue;

    const key =
      part.substring(0, pos).trim();

    const value =
      part.substring(pos + 1).trim();

    if (key === "ts") {
      ts = value;
    }

    if (key === "v1") {
      v1 = value;
    }
  }

  if (!ts || !v1) {
    console.warn(
        "Webhook sem ts ou v1",
    );
    return false;
  }

  /*
   * Coleta as possíveis formas em que
   * Mercado Pago pode entregar data.id.
   */
  const candidates = [];

  function addCandidate(value, source) {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return;
    }

    let id = String(value).trim();

    if (!id) return;

    /*
     * A documentação do Mercado Pago
     * exige minúsculas para IDs alfanuméricos.
     */
    if (/[a-zA-Z]/.test(id)) {
      id = id.toLowerCase();
    }

    if (
      !candidates.some(
          (item) => item.id === id,
      )
    ) {
      candidates.push({
        id,
        source,
      });
    }
  }

  /*
   * 1. Forma oficial:
   * ?data.id=...
   */
  addCandidate(
      req.query &&
        req.query["data.id"],
      "query:data.id",
  );

  /*
   * 2. Alguns frameworks convertem
   * data.id para data_id.
   */
  addCandidate(
      req.query &&
        req.query.data_id,
      "query:data_id",
  );

  /*
   * 3. Lê diretamente a URL original.
   */
  try {
    const originalUrl =
      String(req.originalUrl || "");

    const question =
      originalUrl.indexOf("?");

    if (question !== -1) {
      const params =
        new URLSearchParams(
            originalUrl.substring(
                question + 1,
            ),
        );

      addCandidate(
          params.get("data.id"),
          "url:data.id",
      );

      addCandidate(
          params.get("data_id"),
          "url:data_id",
      );
    }
  } catch (error) {
    console.warn(
        "Não foi possível ler query da URL",
    );
  }

  /*
   * 4. O simulador também envia
   * data.id no corpo.
   */
  addCandidate(
      req.body &&
        req.body.data &&
        req.body.data.id,
      "body:data.id",
  );

  /*
   * Se não existir ID, a documentação
   * determina que esse campo seja omitido
   * do manifesto.
   */
  if (candidates.length === 0) {
    candidates.push({
      id: "",
      source: "sem-id",
    });
  }

  const secret =
    MERCADO_PAGO_WEBHOOK_SECRET_V3.value();

  for (const candidate of candidates) {
    let manifest = "";

    if (candidate.id) {
      manifest +=
        `id:${candidate.id};`;
    }

    if (xRequestId) {
      manifest +=
        `request-id:${xRequestId};`;
    }

    manifest +=
      `ts:${ts};`;

    const calculated =
      crypto
          .createHmac(
              "sha256",
              secret,
          )
          .update(manifest)
          .digest("hex");

    if (
      /^[a-f0-9]{64}$/i.test(v1) &&
      calculated.length === v1.length
    ) {
      const valid =
        crypto.timingSafeEqual(
            Buffer.from(
                calculated,
                "hex",
            ),
            Buffer.from(
                v1,
                "hex",
            ),
        );

      if (valid) {
        console.log(
            "Assinatura válida usando:",
            candidate.source,
        );

        return true;
      }
    }
  }

  console.warn(
      "Nenhuma combinação validou " +
      "a assinatura do Mercado Pago",
  );

  return false;
}


const mercadoPagoWebhookLegacyP16_4 = onRequest(
    {
      region: "southamerica-east1",
      secrets: [
        MERCADO_PAGO_ACCESS_TOKEN,
        MERCADO_PAGO_WEBHOOK_SECRET_V3,
      ],
      timeoutSeconds: 30,
    },
    async (req, res) => {
      if (req.method !== "POST") {
        return res.status(200).send("ok");
      }

      if (
        !validarAssinaturaMercadoPagoV3(
            req,
        )
      ) {
        return res
            .status(401)
            .send("assinatura invalida");
      }

      const body =
        req.body || {};

      let orderId =
        String(
            body?.data?.id ||
            req.query?.["data.id"] ||
            req.query?.data_id ||
            "",
        ).trim();

      /*
       * Recuperação direta da URL.
       */
      if (!orderId) {
        try {
          const originalUrl =
            String(
                req.originalUrl || "",
            );

          const question =
            originalUrl.indexOf("?");

          if (question !== -1) {
            const params =
              new URLSearchParams(
                  originalUrl.substring(
                      question + 1,
                  ),
              );

            orderId =
              String(
                  params.get("data.id") ||
                  params.get("data_id") ||
                  "",
              ).trim();
          }
        } catch (error) {
          console.warn(
              "Falha lendo orderId da URL",
          );
        }
      }

      console.log(
          "WEBHOOK VALIDADO:",
          body.action || "",
          orderId,
      );

      if (!orderId) {
        return res.status(200).send("ok");
      }

      try {
        /*
         * A assinatura prova a origem.
         * Mesmo assim consultamos o Mercado Pago
         * para verificar o pagamento real.
         */
        const response =
          await fetch(
              "https://api.mercadopago.com/v1/orders/" +
              encodeURIComponent(orderId),
              {
                method: "GET",
                headers: {
                  "Authorization":
                    "Bearer " +
                    MERCADO_PAGO_ACCESS_TOKEN
                        .value(),
                  "accept":
                    "application/json",
                },
              },
          );

        const order =
          await response.json();

        /*
         * O simulador usa um ID fictício.
         * Assinatura válida já é suficiente
         * para o teste do webhook retornar 200.
         */
        if (!response.ok) {
          console.log(
              "Webhook válido. Order não " +
              "encontrada na API:",
              orderId,
              response.status,
          );

          return res
              .status(200)
              .send("ok");
        }

        const payment =
          Array.isArray(
              order.transactions?.payments,
          ) ?
            order.transactions
                .payments[0] || {} :
            {};

        const paid =
          (
            order.status ===
              "processed" &&
            order.status_detail ===
              "accredited"
          ) ||
          (
            payment.status ===
              "processed" &&
            payment.status_detail ===
              "accredited"
          );

        if (!paid) {
          console.log(
              "Order ainda pendente:",
              order.status,
              order.status_detail,
          );

          return res
              .status(200)
              .send("ok");
        }

        const db =
          getFirestore();

        /*
         * Só confirma cobranças criadas
         * pelo próprio Green Park.
         */
        const savedOrder =
          await db
              .collection("pix_orders")
              .doc(orderId)
              .get();

        if (!savedOrder.exists) {
          console.warn(
              "Order não pertence " +
              "ao Green Park:",
              orderId,
          );

          return res
              .status(200)
              .send("ok");
        }

        const savedData =
          savedOrder.data() || {};

        const userId =
          String(
              savedData.userId || "",
          );

        if (!userId) {
          console.error(
              "Order sem userId:",
              orderId,
          );

          return res
              .status(200)
              .send("ok");
        }

        /*
         * Evita contar o mesmo pagamento
         * mais de uma vez.
         */
        if (
          savedData
              .webhookConfirmed === true
        ) {
          console.log(
              "Pagamento já confirmado:",
              orderId,
          );

          return res
              .status(200)
              .send("ok");
        }

        const playerRef =
          db
              .collection("players")
              .doc(userId);

        const playerSnapshot =
          await playerRef.get();

        const playerData =
          playerSnapshot.exists ?
            playerSnapshot.data() || {} :
            {};

        const confirmedAt =
          playerData.confirmedAt ||
          FieldValue.serverTimestamp();

        await playerRef.set(
            {
              status: "confirmed",
              paymentStatus: "approved",
              paymentProvider:
                "mercadopago",
              paymentOrderId: orderId,
              confirmedAt,
              updatedAt:
                FieldValue
                    .serverTimestamp(),
            },
            {
              merge: true,
            },
        );

        await savedOrder.ref.set(
            {
              status: "processed",
              statusDetail:
                "accredited",
              confirmed: true,
              webhookConfirmed: true,
              webhookConfirmedAt:
                FieldValue
                    .serverTimestamp(),
            },
            {
              merge: true,
            },
        );

        /*
         * Home atualiza imediatamente.
         */
        await atualizarContagemRacha(
            db,
        );

        /*
         * Push é complementar.
         */
        if (playerData.fcmToken) {
          try {
            await getMessaging().send({
              token:
                playerData.fcmToken,
              notification: {
                title:
                  "Pagamento confirmado",
                body:
                  "Seu Pix foi confirmado. " +
                  "Sua vaga está garantida.",
              },
              webpush: {
                headers: {
                  Urgency: "high",
                },
              },
            });
          } catch (
            notificationError
          ) {
            console.warn(
                "Push não enviado:",
                notificationError.message,
            );
          }
        }

        console.log(
            "PAGAMENTO CONFIRMADO " +
            "VIA WEBHOOK:",
            orderId,
            userId,
        );

        return res
            .status(200)
            .send("ok");
      } catch (error) {
        console.error(
            "Erro webhook:",
            error,
        );

        return res
            .status(500)
            .send("erro");
      }
    },
);
const MERCADO_PAGO_WEBHOOK_SECRET_V4 =
  require("firebase-functions/params")
      .defineSecret("MERCADO_PAGO_WEBHOOK_SECRET");


function validarAssinaturaMercadoPagoV4(req) {
  const crypto = require("crypto");

  const xSignature =
    String(req.headers["x-signature"] || "").trim();

  const xRequestId =
    String(req.headers["x-request-id"] || "").trim();

  if (!xSignature) {
    console.warn("Webhook sem x-signature");
    return false;
  }

  let ts = "";
  let v1 = "";

  for (const part of xSignature.split(",")) {
    const pos = part.indexOf("=");

    if (pos === -1) continue;

    const key =
      part.substring(0, pos).trim();

    const value =
      part.substring(pos + 1).trim();

    if (key === "ts") {
      ts = value;
    }

    if (key === "v1") {
      v1 = value;
    }
  }

  if (!ts || !v1) {
    console.warn(
        "Webhook sem ts ou v1",
    );
    return false;
  }

  /*
   * Coleta as possíveis formas em que
   * Mercado Pago pode entregar data.id.
   */
  const candidates = [];

  function addCandidate(value, source) {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return;
    }

    let id = String(value).trim();

    if (!id) return;

    /*
     * A documentação do Mercado Pago
     * exige minúsculas para IDs alfanuméricos.
     */
    if (/[a-zA-Z]/.test(id)) {
      id = id.toLowerCase();
    }

    if (
      !candidates.some(
          (item) => item.id === id,
      )
    ) {
      candidates.push({
        id,
        source,
      });
    }
  }

  /*
   * 1. Forma oficial:
   * ?data.id=...
   */
  addCandidate(
      req.query &&
        req.query["data.id"],
      "query:data.id",
  );

  /*
   * 2. Alguns frameworks convertem
   * data.id para data_id.
   */
  addCandidate(
      req.query &&
        req.query.data_id,
      "query:data_id",
  );

  /*
   * 3. Lê diretamente a URL original.
   */
  try {
    const originalUrl =
      String(req.originalUrl || "");

    const question =
      originalUrl.indexOf("?");

    if (question !== -1) {
      const params =
        new URLSearchParams(
            originalUrl.substring(
                question + 1,
            ),
        );

      addCandidate(
          params.get("data.id"),
          "url:data.id",
      );

      addCandidate(
          params.get("data_id"),
          "url:data_id",
      );
    }
  } catch (error) {
    console.warn(
        "Não foi possível ler query da URL",
    );
  }


  /*
   * Se não existir ID, a documentação
   * determina que esse campo seja omitido
   * do manifesto.
   */
  if (candidates.length === 0) {
    candidates.push({
      id: "",
      source: "sem-id",
    });
  }

  const secret =
    MERCADO_PAGO_WEBHOOK_SECRET_V4.value();

  for (const candidate of candidates) {
    let manifest = "";

    if (candidate.id) {
      manifest +=
        `id:${candidate.id};`;
    }

    if (xRequestId) {
      manifest +=
        `request-id:${xRequestId};`;
    }

    manifest +=
      `ts:${ts};`;

    const calculated =
      crypto
          .createHmac(
              "sha256",
              secret,
          )
          .update(manifest)
          .digest("hex");

    if (
      /^[a-f0-9]{64}$/i.test(v1) &&
      calculated.length === v1.length
    ) {
      const valid =
        crypto.timingSafeEqual(
            Buffer.from(
                calculated,
                "hex",
            ),
            Buffer.from(
                v1,
                "hex",
            ),
        );

      if (valid) {
        console.log(
            "Assinatura válida usando:",
            candidate.source,
        );

        return true;
      }
    }
  }

  console.warn(
      "Nenhuma combinação validou " +
      "a assinatura do Mercado Pago",
  );

  return false;
}


const mercadoPagoWebhookLegacyP16_5 = onRequest(
    {
      region: "southamerica-east1",
      secrets: [
        MERCADO_PAGO_ACCESS_TOKEN,
        MERCADO_PAGO_WEBHOOK_SECRET_V4,
      ],
      timeoutSeconds: 30,
    },
    async (req, res) => {
      if (req.method !== "POST") {
        return res.status(200).send("ok");
      }

      if (
        !validarAssinaturaMercadoPagoV4(
            req,
        )
      ) {
        return res
            .status(401)
            .send("assinatura invalida");
      }

      const body =
        req.body || {};

      let orderId =
        String(
            body?.data?.id ||
            req.query?.["data.id"] ||
            req.query?.data_id ||
            "",
        ).trim();

      /*
       * Recuperação direta da URL.
       */
      if (!orderId) {
        try {
          const originalUrl =
            String(
                req.originalUrl || "",
            );

          const question =
            originalUrl.indexOf("?");

          if (question !== -1) {
            const params =
              new URLSearchParams(
                  originalUrl.substring(
                      question + 1,
                  ),
              );

            orderId =
              String(
                  params.get("data.id") ||
                  params.get("data_id") ||
                  "",
              ).trim();
          }
        } catch (error) {
          console.warn(
              "Falha lendo orderId da URL",
          );
        }
      }

      console.log(
          "WEBHOOK VALIDADO:",
          body.action || "",
          orderId,
      );

      if (!orderId) {
        return res.status(200).send("ok");
      }

      try {
        /*
         * A assinatura prova a origem.
         * Mesmo assim consultamos o Mercado Pago
         * para verificar o pagamento real.
         */
        const response =
          await fetch(
              "https://api.mercadopago.com/v1/orders/" +
              encodeURIComponent(orderId),
              {
                method: "GET",
                headers: {
                  "Authorization":
                    "Bearer " +
                    MERCADO_PAGO_ACCESS_TOKEN
                        .value(),
                  "accept":
                    "application/json",
                },
              },
          );

        const order =
          await response.json();

        /*
         * O simulador usa um ID fictício.
         * Assinatura válida já é suficiente
         * para o teste do webhook retornar 200.
         */
        if (!response.ok) {
          console.log(
              "Webhook válido. Order não " +
              "encontrada na API:",
              orderId,
              response.status,
          );

          return res
              .status(200)
              .send("ok");
        }

        const payment =
          Array.isArray(
              order.transactions?.payments,
          ) ?
            order.transactions
                .payments[0] || {} :
            {};

        const paid =
          (
            order.status ===
              "processed" &&
            order.status_detail ===
              "accredited"
          ) ||
          (
            payment.status ===
              "processed" &&
            payment.status_detail ===
              "accredited"
          );

        if (!paid) {
          console.log(
              "Order ainda pendente:",
              order.status,
              order.status_detail,
          );

          return res
              .status(200)
              .send("ok");
        }

        const db =
          getFirestore();

        /*
         * Só confirma cobranças criadas
         * pelo próprio Green Park.
         */
        const savedOrder =
          await db
              .collection("pix_orders")
              .doc(orderId)
              .get();

        if (!savedOrder.exists) {
          console.warn(
              "Order não pertence " +
              "ao Green Park:",
              orderId,
          );

          return res
              .status(200)
              .send("ok");
        }

        const savedData =
          savedOrder.data() || {};

        const userId =
          String(
              savedData.userId || "",
          );

        if (!userId) {
          console.error(
              "Order sem userId:",
              orderId,
          );

          return res
              .status(200)
              .send("ok");
        }

        /*
         * Evita contar o mesmo pagamento
         * mais de uma vez.
         */
        if (
          savedData
              .webhookConfirmed === true
        ) {
          console.log(
              "Pagamento já confirmado:",
              orderId,
          );

          return res
              .status(200)
              .send("ok");
        }

        const playerRef =
          db
              .collection("players")
              .doc(userId);

        const playerSnapshot =
          await playerRef.get();

        const playerData =
          playerSnapshot.exists ?
            playerSnapshot.data() || {} :
            {};

        const confirmedAt =
          playerData.confirmedAt ||
          FieldValue.serverTimestamp();

        await playerRef.set(
            {
              status: "confirmed",
              paymentStatus: "approved",
              paymentProvider:
                "mercadopago",
              paymentOrderId: orderId,
              confirmedAt,
              updatedAt:
                FieldValue
                    .serverTimestamp(),
            },
            {
              merge: true,
            },
        );

        await savedOrder.ref.set(
            {
              status: "processed",
              statusDetail:
                "accredited",
              confirmed: true,
              webhookConfirmed: true,
              webhookConfirmedAt:
                FieldValue
                    .serverTimestamp(),
            },
            {
              merge: true,
            },
        );

        /*
         * Home atualiza imediatamente.
         */
        await atualizarContagemRacha(
            db,
        );

        /*
         * Push é complementar.
         */
        if (playerData.fcmToken) {
          try {
            await getMessaging().send({
              token:
                playerData.fcmToken,
              notification: {
                title:
                  "Pagamento confirmado",
                body:
                  "Seu Pix foi confirmado. " +
                  "Sua vaga está garantida.",
              },
              webpush: {
                headers: {
                  Urgency: "high",
                },
              },
            });
          } catch (
            notificationError
          ) {
            console.warn(
                "Push não enviado:",
                notificationError.message,
            );
          }
        }

        console.log(
            "PAGAMENTO CONFIRMADO " +
            "VIA WEBHOOK:",
            orderId,
            userId,
        );

        return res
            .status(200)
            .send("ok");
      } catch (error) {
        console.error(
            "Erro webhook:",
            error,
        );

        return res
            .status(500)
            .send("erro");
      }
    },
);
const mercadoPagoWebhookLegacyP16_6 = onRequest(
    {
      region: "southamerica-east1",
      secrets: [
        MERCADO_PAGO_ACCESS_TOKEN,
      ],
      timeoutSeconds: 30,
    },
    async (req, res) => {
      /*
       * Mercado Pago envia POST.
       * Outras chamadas apenas recebem OK.
       */
      if (req.method !== "POST") {
        return res.status(200).send("ok");
      }

      try {
        const body = req.body || {};

        /*
         * Só nos interessa o tópico Order.
         */
        if (
          body.type &&
          body.type !== "order" &&
          body.type !== "orders"
        ) {
          console.log(
              "Webhook ignorado. Tipo:",
              body.type,
          );

          return res.status(200).send("ok");
        }

        /*
         * Pega o ID da Order.
         */
        const orderId = String(
            body?.data?.id ||
            req.query?.["data.id"] ||
            req.query?.data_id ||
            "",
        ).trim();

        console.log(
            "Webhook recebido:",
            body.action || "",
            orderId || "sem-order-id",
        );

        if (!orderId) {
          return res.status(200).send("ok");
        }

        const db = getFirestore();

        /*
         * SEGURANÇA PRINCIPAL:
         * antes de consultar Mercado Pago,
         * verificamos se essa order foi criada
         * pelo próprio Green Park.
         */
        const savedOrderRef =
          db.collection("pix_orders").doc(orderId);

        const savedOrder =
          await savedOrderRef.get();

        if (!savedOrder.exists) {
          console.log(
              "Order ignorada: não pertence " +
              "ao Green Park:",
              orderId,
          );

          /*
           * O simulador usa uma order fictícia.
           * Portanto deve chegar exatamente aqui
           * e responder 200.
           */
          return res.status(200).send("ok");
        }

        const savedData =
          savedOrder.data() || {};

        const userId =
          String(savedData.userId || "");

        if (!userId) {
          console.error(
              "Order Green Park sem userId:",
              orderId,
          );

          return res.status(200).send("ok");
        }

        /*
         * Evita processar novamente uma
         * confirmação já concluída.
         */
        if (
          savedData.webhookConfirmed === true
        ) {
          console.log(
              "Order já confirmada:",
              orderId,
          );

          if (
            !savedData.adminPushSentAt ||
            !savedData.playerPushSentAt
          ) {
            try {
              const playerSnapshot = await db
                  .collection("players")
                  .doc(userId)
                  .get();

              const playerData = playerSnapshot.exists ?
                playerSnapshot.data() || {} :
                {};

              await sendPixConfirmedPushes(db, {
                orderId,
                userId,
                playerData,
                includeAdmin: !savedData.adminPushSentAt,
                includePlayer: !savedData.playerPushSentAt,
              });

              console.log(
                  "Retry de Push da order confirmada:",
                  orderId,
              );
            } catch (retryPushError) {
              console.warn(
                  "Falha no retry de Push:",
                  orderId,
                  retryPushError.message,
              );
            }
          }

          return res.status(200).send("ok");
        }

        /*
         * NÃO confiamos no status recebido
         * pelo webhook.
         *
         * Consultamos diretamente a API
         * do Mercado Pago usando nosso token.
         */
        const response = await fetch(
            "https://api.mercadopago.com/v1/orders/" +
            encodeURIComponent(orderId),
            {
              method: "GET",
              headers: {
                "Authorization":
                  "Bearer " +
                  MERCADO_PAGO_ACCESS_TOKEN.value(),
                "Accept": "application/json",
              },
            },
        );

        const order = await response.json();

        if (!response.ok) {
          console.error(
              "Erro consultando Mercado Pago:",
              response.status,
              orderId,
          );

          /*
           * Em erro temporário do Mercado Pago,
           * pedimos nova tentativa.
           */
          if (response.status >= 500) {
            return res
                .status(500)
                .send("retry");
          }

          return res.status(200).send("ok");
        }

        const payments =
          Array.isArray(
              order.transactions?.payments,
          ) ?
            order.transactions.payments :
            [];

        const payment =
          payments[0] || {};

        /*
         * Esta é a confirmação verdadeira.
         */
        const paid =
          (
            order.status === "processed" &&
            order.status_detail === "accredited"
          ) ||
          (
            payment.status === "processed" &&
            payment.status_detail === "accredited"
          );

        console.log(
            "Status Mercado Pago:",
            orderId,
            order.status || "",
            order.status_detail || "",
            payment.status || "",
            payment.status_detail || "",
        );

        /*
         * Ainda não caiu.
         * Esperamos próxima notificação.
         */
        if (!paid) {
          return res.status(200).send("ok");
        }

        const playerRef =
          db.collection("players").doc(userId);

        const playerSnapshot =
          await playerRef.get();

        const playerData =
          playerSnapshot.exists ?
            playerSnapshot.data() || {} :
            {};

        const confirmedAt =
          playerData.confirmedAt ||
          FieldValue.serverTimestamp();

        /*
         * CONFIRMA O JOGADOR.
         */
        const paidType =
          savedData.type === "monthly" ?
            "monthly" :
            "daily";

        const playerPatch = {
          status: "confirmed",
          paymentStatus: "approved",
          paymentProvider: "mercadopago",
          paymentOrderId: orderId,
          paymentType: paidType,
          attendanceType: paidType,
          confirmedAt,
          updatedAt:
            FieldValue.serverTimestamp(),
        };

        if (paidType === "monthly") {
          playerPatch.billingType = "monthly";
          playerPatch.monthlyPaidThrough =
            financeSaoPauloParts().monthKey;
        }

        await playerRef.set(
            playerPatch,
            {
              merge: true,
            },
        );

        /*
         * Marca a order como processada.
         */
        await savedOrderRef.set(
            {
              status: "processed",
              statusDetail: "accredited",
              confirmed: true,
              webhookConfirmed: true,
              webhookConfirmedAt:
                FieldValue.serverTimestamp(),
            },
            {
              merge: true,
            },
        );

        /*
         * Atualiza Confirmados/Vagas
         * imediatamente.
         */
        await atualizarContagemRacha(db);

        /*
         * Push unificado do Pix real.
         * Admin recebe o valor/nome; jogador recebe a confirmação.
         */
        try {
          await sendPixConfirmedPushes(db, {
            orderId,
            userId,
            playerData,
            includeAdmin: true,
            includePlayer: true,
          });
        } catch (notificationError) {
          console.warn(
              "Pagamento aprovado, mas Push não enviado:",
              notificationError.message,
          );
        }

        console.log(
            "PAGAMENTO CONFIRMADO VIA WEBHOOK:",
            orderId,
            userId,
        );

        return res.status(200).send("ok");
      } catch (error) {
        console.error(
            "Erro no webhook:",
            error,
        );

        return res.status(500).send("erro");
      }
    },
);
exports.pixConfirmadoPush = onDocumentUpdated(
    {
      document: "pix_orders/{orderId}",
      region: "southamerica-east1",
    },
    async (event) => {
      if (!event.data) {
        return null;
      }

      const before = event.data.before.data() || {};
      const after = event.data.after.data() || {};

      const becameConfirmed =
        after.confirmed === true &&
        before.confirmed !== true;

      if (!becameConfirmed) {
        return null;
      }

      const orderId = event.params.orderId;
      const userId = String(after.userId || "").trim();

      if (!userId) {
        console.warn(
            "Pix confirmado sem userId para Push:",
            orderId,
        );
        return null;
      }

      const db = getFirestore();
      const playerSnapshot = await db
          .collection("players")
          .doc(userId)
          .get();

      const playerData = playerSnapshot.exists ?
        playerSnapshot.data() || {} :
        {};

      try {
        await sendPixConfirmedPushes(db, {
          orderId,
          userId,
          playerData,
          includeAdmin: true,
          includePlayer: true,
        });

        console.log(
            "Push garantido pelo gatilho pix_orders:",
            orderId,
        );
      } catch (error) {
        console.warn(
            "Falha no gatilho de Push pix_orders:",
            orderId,
            error.message,
        );
      }

      return null;
    },
);

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
        position:
          data.position ===
            "goalkeeper" ?
            "goalkeeper" :
            "field",
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
         * Ranking é da TEMPORADA.
         * Portanto o histórico não desaparece quando começa um novo racha.
         * Confirmados atuais entram mesmo com 0 gols; jogadores que já tiveram
         * estatística continuam no ranking mesmo que ainda não tenham confirmado
         * presença no racha atual.
         */
        if (!playerId) {
          return;
        }

        if (!map.has(playerId)) {
          map.set(playerId, {
            playerId,
            name: unifiedSafeName(stat.name || "Jogador"),
            photoURL: String(stat.photoURL || "").slice(0, 2000),
            goals: 0,
            goalkeeperGames: 0,
            goalsConceded: 0,
          });
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
   * Artilharia da temporada:
   * confirmados atuais aparecem até com 0 gols;
   * histórico de quem já pontuou é preservado.
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
   * entra no ranking desde o primeiro jogo no gol.
   * Critério principal: menor média de gols sofridos por jogo.
   */
  const goalkeepers =
    all
        .filter(
            (item) =>
              item.goalkeeperGames >= 1,
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


// ========================================================
// ADMIN — LISTAR TODOS OS JOGADORES CADASTRADOS
// A base de jogadores é permanente entre os rachas.
// ========================================================



exports.salvarMeuPushToken = onCall(
    {
      invoker: "public",
      region: "southamerica-east1",
      timeoutSeconds: 20,
    },
    async (request) => {
      if (!request.auth?.uid) {
        throw new HttpsError(
            "unauthenticated",
            "Entre no aplicativo antes de ativar as notificações.",
        );
      }

      const uid =
        String(request.auth.uid || "")
            .trim()
            .slice(0, 128);

      const token =
        String(request.data?.token || "")
            .trim()
            .slice(0, 4096);

      if (!uid) {
        throw new HttpsError(
            "unauthenticated",
            "Usuário não identificado.",
        );
      }

      if (token.length < 20) {
        throw new HttpsError(
            "invalid-argument",
            "Token de notificação inválido.",
        );
      }

      const db = getFirestore();
      const playerRef =
        db.collection("players")
            .doc(uid);

      const snapshot =
        await playerRef.get();

      const current =
        snapshot.exists ?
          (snapshot.data() || {}) :
          {};

      const previousTokens =
        collectFcmTokens(current);

      const nextTokens =
        [...new Set(
            [
              ...previousTokens,
              token,
            ],
        )]
            .filter(Boolean)
            .slice(-10);

      const payload = {
        uid,
        fcmToken: token,
        fcmTokens: nextTokens,
        notificationsEnabled: true,
        notificationUpdatedAt:
          FieldValue.serverTimestamp(),
      };

      // Se for o UID oficial do Admin, preserva/define a role.
      if (
        uid ===
        GREEN_PARK_ADMIN_UID_FINANCE
      ) {
        payload.role = "admin";
      }

      await playerRef.set(
          payload,
          {merge: true},
      );

      return {
        ok: true,
        savedTokens: nextTokens.length,
      };
    },
);


const GREEN_PARK_GOALKEEPER_LIMIT = 2;

async function greenParkApplyPlayerPosition({
  db,
  playerId,
  position,
  updatedBy = "",
}) {
  const playerRef = db.collection("players").doc(playerId);
  const rachaRef = db.collection("racha").doc("current");

  return db.runTransaction(async (transaction) => {
    const playerSnapshot = await transaction.get(playerRef);

    if (!playerSnapshot.exists) {
      throw new HttpsError(
          "failed-precondition",
          "Salve o cadastro antes de definir a posição.",
      );
    }

    const playerData = playerSnapshot.data() || {};

    if (position === "goalkeeper") {
      greenParkRequirePlayerPhoto(
          playerData,
      );
    }

    const rachaSnapshot = await transaction.get(rachaRef);
    const currentRachaData = rachaSnapshot.exists ?
      rachaSnapshot.data() || {} : {};

    const confirmedQuery = db.collection("players")
        .where("status", "==", "confirmed");
    const confirmedSnapshot = await transaction.get(confirmedQuery);

    const wasConfirmed = playerData.status === "confirmed";
    const maxPlayers = Math.max(
        1,
        Number(currentRachaData.maxPlayers) || 40,
    );

    const commonPatch = {
      position,
      positionUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      ...(updatedBy ? {positionUpdatedBy: updatedBy} : {}),
    };

    if (position !== "goalkeeper") {
      const wasFreeGoalkeeper =
        wasConfirmed &&
        playerData.confirmationSource === "goalkeeper" &&
        playerData.goalkeeperFree === true;

      if (wasFreeGoalkeeper) {
        transaction.set(
            playerRef,
            {
              ...commonPatch,
              status: "registered",
              paymentExempt: false,
              goalkeeperFree: false,
              confirmationSource: FieldValue.delete(),
              confirmedAt: FieldValue.delete(),
              goalkeeperConfirmedAt: FieldValue.delete(),
            },
            {merge: true},
        );

        transaction.set(
            rachaRef,
            {
              confirmedCount: Math.max(0, confirmedSnapshot.size - 1),
              updatedAt: FieldValue.serverTimestamp(),
            },
            {merge: true},
        );

        return {
          confirmed: false,
          goalkeeperConfirmed: false,
          confirmationRevoked: true,
        };
      }

      transaction.set(
          playerRef,
          {...commonPatch, goalkeeperFree: false},
          {merge: true},
      );

      return {
        confirmed: wasConfirmed,
        goalkeeperConfirmed: false,
        confirmationRevoked: false,
      };
    }

    const otherGoalkeepers = confirmedSnapshot.docs.filter((docSnap) =>
      docSnap.id !== playerId &&
      docSnap.data()?.position === "goalkeeper"
    ).length;

    if (otherGoalkeepers >= GREEN_PARK_GOALKEEPER_LIMIT) {
      throw new HttpsError(
          "resource-exhausted",
          "Vagas de goleiro preenchidas. Já temos 2 goleiros confirmados para este racha.",
      );
    }

    if (!wasConfirmed && confirmedSnapshot.size >= maxPlayers) {
      throw new HttpsError(
          "resource-exhausted",
          "Racha lotado. No momento não há vagas disponíveis.",
      );
    }

    const patch = {
      ...commonPatch,
      status: "confirmed",
    };

    if (!wasConfirmed) {
      patch.paymentExempt = true;
      patch.goalkeeperFree = true;
      patch.confirmationSource = "goalkeeper";
      patch.confirmedAt = FieldValue.serverTimestamp();
      patch.goalkeeperConfirmedAt = FieldValue.serverTimestamp();
    }

    transaction.set(playerRef, patch, {merge: true});

    const nextConfirmedCount =
      confirmedSnapshot.size + (wasConfirmed ? 0 : 1);

    transaction.set(
        rachaRef,
        {
          confirmedCount: nextConfirmedCount,
          updatedAt: FieldValue.serverTimestamp(),
        },
        {merge: true},
    );

    return {
      confirmed: true,
      goalkeeperConfirmed: true,
      goalkeeperCount: otherGoalkeepers + 1,
      confirmedCount: nextConfirmedCount,
      confirmationRevoked: false,
    };
  });
}

exports.salvarMinhaPosicao = onCall(
    {
      invoker: "public",
      region: "southamerica-east1",
      timeoutSeconds: 20,
    },
    async (request) => {
      if (!request.auth?.uid) {
        throw new HttpsError(
            "unauthenticated",
            "Entre no aplicativo antes de salvar a posição.",
        );
      }

      const uid = String(request.auth.uid || "").trim();

      if (!uid || uid === GREEN_PARK_ADMIN_UID_FINANCE) {
        throw new HttpsError(
            "failed-precondition",
            "Administrador não pode usar o cadastro de jogador.",
        );
      }

      const position = String(request.data?.position || "").trim();

      if (!["field", "goalkeeper"].includes(position)) {
        throw new HttpsError(
            "invalid-argument",
            "Posição inválida.",
        );
      }

      const db = getFirestore();
      const result = await greenParkApplyPlayerPosition({
        db,
        playerId: uid,
        position,
      });

      return {ok: true, playerId: uid, position, ...result};
    },
);

exports.definirPosicaoJogador = onCall(
    {
      invoker: "public",
      region: "southamerica-east1",
      timeoutSeconds: 20,
    },
    async (request) => {
      unifiedAdminOrThrow(request);

      const playerId = String(request.data?.playerId || "")
          .trim()
          .slice(0, 128);
      const position = String(request.data?.position || "").trim();

      if (!playerId || !["field", "goalkeeper"].includes(position)) {
        throw new HttpsError(
            "invalid-argument",
            "Posição de jogador inválida.",
        );
      }

      if (playerId === GREEN_PARK_ADMIN_UID_FINANCE) {
        throw new HttpsError(
            "failed-precondition",
            "O administrador não é um jogador.",
        );
      }

      const db = getFirestore();
      const result = await greenParkApplyPlayerPosition({
        db,
        playerId,
        position,
        updatedBy: request.auth.uid,
      });

      return {ok: true, playerId, position, ...result};
    },
);


async function greenParkRemovePlayerFromCurrentRacha(
    db,
    playerId,
    adminUid,
) {
  const playerRef =
    db.collection("players").doc(playerId);

  const snapshot =
    await playerRef.get();

  if (!snapshot.exists) {
    throw new HttpsError(
        "not-found",
        "Atleta não encontrado.",
    );
  }

  const data =
    snapshot.data() || {};

  if (data.status === "confirmed") {
    await playerRef.set(
        {
          status: "registered",
          attendanceType: "",
          paymentReported: false,
          paymentType: "",
          pixOrderId: "",
          pixStatus: "",
          pixProvider: "",
          paymentExempt: false,
          goalkeeperFree: false,
          paymentStatus:
            FieldValue.delete(),
          paymentOrderId:
            FieldValue.delete(),
          paymentProvider:
            FieldValue.delete(),
          confirmationSource:
            FieldValue.delete(),
          confirmedAt:
            FieldValue.delete(),
          goalkeeperConfirmedAt:
            FieldValue.delete(),
          removedFromRachaAt:
            FieldValue.serverTimestamp(),
          removedFromRachaBy:
            adminUid,
          updatedAt:
            FieldValue.serverTimestamp(),
        },
        {merge: true},
    );
  }

  return atualizarContagemRacha(db);
}


exports.cancelarJogadorDoRacha = onCall(
    {
      invoker: "public",
      region: "southamerica-east1",
      timeoutSeconds: 20,
    },
    async (request) => {
      unifiedAdminOrThrow(request);

      const playerId =
        String(request.data?.playerId || "")
            .trim()
            .slice(0, 128);

      if (
        !playerId ||
        playerId === GREEN_PARK_ADMIN_UID_FINANCE
      ) {
        throw new HttpsError(
            "invalid-argument",
            "Atleta inválido.",
        );
      }

      const db = getFirestore();

      const confirmedCount =
        await greenParkRemovePlayerFromCurrentRacha(
            db,
            playerId,
            request.auth.uid,
        );

      return {
        ok: true,
        playerId,
        confirmedCount,
        profilePreserved: true,
        financePreserved: true,
        statsPreserved: true,
      };
    },
);


// Apaga identidade/cadastro do atleta.
// Histórico financeiro e estatístico não é apagado:
// ele é anonimizado para manter saldo, auditoria e gols antigos.
function greenParkRecordDirectlyReferencesPlayer(
    value,
    {
      playerId,
      email,
      phone,
    },
) {
  if (!value || typeof value !== "object") {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) =>
      greenParkRecordDirectlyReferencesPlayer(
          item,
          {playerId, email, phone},
      )
    );
  }

  for (const [key, item] of Object.entries(value)) {
    if (
      ["userId", "playerId", "uid", "payerId"].includes(key) &&
      String(item || "") === playerId
    ) {
      return true;
    }

    if (
      email &&
      ["email", "payerEmail"].includes(key) &&
      String(item || "").trim().toLowerCase() === email
    ) {
      return true;
    }

    if (
      phone &&
      ["phone", "telefone"].includes(key) &&
      String(item || "").replace(/\D/g, "") === phone
    ) {
      return true;
    }

    if (
      item &&
      typeof item === "object" &&
      greenParkRecordDirectlyReferencesPlayer(
          item,
          {playerId, email, phone},
      )
    ) {
      return true;
    }
  }

  return false;
}


function greenParkRedactPlayerNode(
    value,
    identity,
    forceMatch = false,
) {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      greenParkRedactPlayerNode(
          item,
          identity,
          false,
      )
    );
  }

  const directMatch =
    forceMatch ||
    Object.entries(value).some(([key, item]) => {
      if (
        ["userId", "playerId", "uid", "payerId"].includes(key) &&
        String(item || "") === identity.playerId
      ) {
        return true;
      }

      if (
        identity.email &&
        ["email", "payerEmail"].includes(key) &&
        String(item || "").trim().toLowerCase() === identity.email
      ) {
        return true;
      }

      if (
        identity.phone &&
        ["phone", "telefone"].includes(key) &&
        String(item || "").replace(/\D/g, "") === identity.phone
      ) {
        return true;
      }

      return false;
    });

  const result = {};

  for (const [key, item] of Object.entries(value)) {
    if (
      directMatch &&
      ["name", "playerName", "displayName", "nickname", "apelido"].includes(key)
    ) {
      result[key] = "JOGADOR REMOVIDO";
      continue;
    }

    if (
      directMatch &&
      ["email", "payerEmail", "phone", "telefone", "photoURL", "photo"].includes(key)
    ) {
      result[key] = "";
      continue;
    }

    if (
      directMatch &&
      ["fcmToken"].includes(key)
    ) {
      result[key] = "";
      continue;
    }

    if (
      directMatch &&
      key === "fcmTokens"
    ) {
      result[key] = [];
      continue;
    }

    if (
      ["userId", "playerId", "uid", "payerId"].includes(key) &&
      String(item || "") === identity.playerId
    ) {
      result[key] = "";
      continue;
    }

    result[key] =
      item && typeof item === "object" ?
        greenParkRedactPlayerNode(
            item,
            identity,
            false,
        ) :
        item;
  }

  if (directMatch) {
    result.deletedPlayerData = true;
  }

  return result;
}


async function greenParkAnonymizePlayerHistory(
    db,
    identity,
) {
  const collections =
    await db.listCollections();

  let updatedDocuments = 0;

  for (const collection of collections) {
    if (collection.id === "players") {
      continue;
    }

    const snapshot =
      await collection.get();

    for (const docSnap of snapshot.docs) {
      const data =
        docSnap.data() || {};

      const forceMatch =
        docSnap.id === identity.playerId;

      if (
        !forceMatch &&
        !greenParkRecordDirectlyReferencesPlayer(
            data,
            identity,
        )
      ) {
        continue;
      }

      const redacted =
        greenParkRedactPlayerNode(
            data,
            identity,
            forceMatch,
        );

      redacted.deletedPlayerDataAt =
        FieldValue.serverTimestamp();

      await docSnap.ref.set(
          redacted,
          {merge: false},
      );

      updatedDocuments += 1;
    }
  }

  return updatedDocuments;
}


exports.excluirJogadorDefinitivamente = onCall(
    {
      invoker: "public",
      region: "southamerica-east1",
      timeoutSeconds: 60,
      memory: "512MiB",
    },
    async (request) => {
      unifiedAdminOrThrow(request);

      const playerId =
        String(request.data?.playerId || "")
            .trim()
            .slice(0, 128);

      const confirmation =
        String(request.data?.confirmation || "")
            .trim()
            .toUpperCase();

      if (confirmation !== "EXCLUIR") {
        throw new HttpsError(
            "failed-precondition",
            "Confirmação de exclusão inválida.",
        );
      }

      if (
        !playerId ||
        playerId === GREEN_PARK_ADMIN_UID_FINANCE
      ) {
        throw new HttpsError(
            "invalid-argument",
            "Atleta inválido.",
        );
      }

      const db = getFirestore();
      const playerRef =
        db.collection("players").doc(playerId);

      const playerSnapshot =
        await playerRef.get();

      if (!playerSnapshot.exists) {
        throw new HttpsError(
            "not-found",
            "Cadastro do atleta não encontrado.",
        );
      }

      const playerData =
        playerSnapshot.data() || {};

      const identity = {
        playerId,
        email:
          String(playerData.email || "")
              .trim()
              .toLowerCase(),
        phone:
          String(playerData.phone || "")
              .replace(/\D/g, ""),
      };

      // Primeiro remove a vaga do racha atual.
      if (playerData.status === "confirmed") {
        await greenParkRemovePlayerFromCurrentRacha(
            db,
            playerId,
            request.auth.uid,
        );
      }

      // Mantém valores e gols históricos,
      // mas retira identidade pessoal dos registros relacionados.
      const anonymizedDocuments =
        await greenParkAnonymizePlayerHistory(
            db,
            identity,
        );

      // Apaga arquivos de perfil no Storage.
      let deletedStorageFiles = 0;

      try {
        const bucket =
          getStorage().bucket();

        const [files] =
          await bucket.getFiles({
            prefix: "players/" + playerId + "/",
          });

        for (const file of files) {
          await file.delete({
            ignoreNotFound: true,
          });

          deletedStorageFiles += 1;
        }
      } catch (error) {
        console.warn(
            "Storage do atleta:",
            playerId,
            error?.message || error,
        );
      }

      // Apaga documento principal.
      if (typeof db.recursiveDelete === "function") {
        await db.recursiveDelete(playerRef);
      } else {
        await playerRef.delete();
      }

      // Apaga conta anônima/Auth daquele aparelho.
      try {
        await getAuth().deleteUser(playerId);
      } catch (error) {
        if (error?.code !== "auth/user-not-found") {
          console.warn(
              "Auth do atleta:",
              playerId,
              error?.message || error,
          );
        }
      }

      const confirmedCount =
        await atualizarContagemRacha(db);

      return {
        ok: true,
        playerId,
        confirmedCount,
        anonymizedDocuments,
        deletedStorageFiles,
        personalDataDeleted: true,
        financePreserved: true,
        statsPreserved: true,
      };
    },
);


exports.listarJogadoresAdmin = onCall(
    {
      invoker: "public",
      region:
        "southamerica-east1",
      timeoutSeconds: 20,
    },
    async (request) => {
      unifiedAdminOrThrow(
          request,
      );

      const db =
        getFirestore();

      const snapshot =
        await db
            .collection("players")
            .get();

      const current =
        financeSaoPauloParts();

      const players =
        snapshot.docs
            .filter(
                (docSnap) =>
                  docSnap.id !==
                  GREEN_PARK_ADMIN_UID_FINANCE,
            )
            .map(
                (docSnap) => {
                  const data =
                    docSnap.data() || {};

                  const billingType =
                    data.billingType ===
                    "monthly" ?
                    "monthly" :
                    "daily";

                  const paidThrough =
                    financeString(
                        data.monthlyPaidThrough,
                        7,
                    );

                  return {
                    id:
                      docSnap.id,
                    name:
                      financeString(
                          data.name ||
                          "Jogador",
                          80,
                      ),
                    phone:
                      financeString(
                          data.phone,
                          40,
                      ),
                    photoURL:
                      financeString(
                          data.photoURL,
                          1000,
                      ),
                    status:
                      financeString(
                          data.status ||
                          "registered",
                          30,
                      ),
                    position:
                      data.position ===
                        "goalkeeper" ?
                        "goalkeeper" :
                        "field",
                    billingType,
                    monthlyActive:
                      billingType ===
                        "monthly" &&
                      paidThrough >=
                        current.monthKey,
                  };
                },
            )
            .sort(
                (a, b) =>
                  a.name.localeCompare(
                      b.name,
                      "pt-BR",
                  ),
            );

      return {
        count:
          players.length,
        players:
          players.slice(
              0,
              500,
          ),
      };
    },
);


exports.listarConfirmados = onCall(
    {
      invoker: "public",
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
      invoker: "public",
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
              const storedStat =
                stats.get(
                    player.id,
                );

              const stat =
                storedStat || {};

              const hasGoalkeeperFlag =
                typeof stat.isGoalkeeper ===
                  "boolean";

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
                  hasGoalkeeperFlag ?
                    stat.isGoalkeeper === true :
                    player.position ===
                      "goalkeeper",
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
      invoker: "public",
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
      invoker: "public",
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
      invoker: "public",
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
      invoker: "public",
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
      invoker: "public",
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




// ========================================================
// SORTEIO DOS TIMES — VERDE x PRETO
// ========================================================

function greenParkShufflePlayers(items) {
  const array = Array.isArray(items) ? [...items] : [];

  for (let index = array.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [array[index], array[randomIndex]] = [array[randomIndex], array[index]];
  }

  return array;
}


exports.sortearTimesRacha = onCall(
    {
      invoker: "public",
      region: "southamerica-east1",
      timeoutSeconds: 30,
    },
    async (request) => {
      unifiedAdminOrThrow(request);

      const matchKey =
        unifiedSafeMatchKey(
            request.data?.matchKey,
        );

      if (!matchKey) {
        throw new HttpsError(
            "invalid-argument",
            "Defina data e horário do racha antes do sorteio.",
        );
      }

      const db = getFirestore();
      const confirmed = await unifiedConfirmedPlayers(db);

      if (confirmed.length < 2) {
        throw new HttpsError(
            "failed-precondition",
            "São necessários pelo menos 2 jogadores confirmados.",
        );
      }

      const requestedPlayerIds =
        Array.isArray(request.data?.selectedPlayerIds) ?
          [...new Set(
              request.data.selectedPlayerIds
                  .map((value) =>
                    String(value || "").trim(),
                  )
                  .filter(Boolean),
          )].slice(0, 100) :
          [];

      const selectedPlayers =
        requestedPlayerIds.length ?
          confirmed.filter(
              (player) =>
                requestedPlayerIds.includes(
                    String(player.id),
                ),
          ) :
          confirmed;

      if (selectedPlayers.length < 2) {
        throw new HttpsError(
            "failed-precondition",
            "Selecione pelo menos 2 jogadores confirmados para o sorteio.",
        );
      }

      // Regra do Green Park: 1 goleiro em cada time.
      // A posição é definida no cadastro e pode ser corrigida pelo Admin.
      const goalkeepers = selectedPlayers.filter(
          (player) =>
            player.position ===
              "goalkeeper",
      );

      const fieldPlayers = selectedPlayers.filter(
          (player) =>
            player.position !==
              "goalkeeper",
      );

      if (goalkeepers.length < 2) {
        throw new HttpsError(
            "failed-precondition",
            "Defina pelo menos 2 jogadores como GOLEIRO em Administrador > Jogadores antes de sortear.",
        );
      }

      const shuffledGoalkeepers =
        greenParkShufflePlayers(goalkeepers);

      const shuffledFieldPlayers =
        greenParkShufflePlayers(fieldPlayers);

      const green = [];
      const black = [];

      const cleanTeamPlayer = (
          player,
          isGoalkeeper = false,
      ) => ({
        playerId: player.id,
        name: unifiedSafeName(player.name),
        photoURL: String(player.photoURL || "").slice(0, 2000),
        isGoalkeeper,
      });

      // Um goleiro obrigatório para cada time.
      green.push(
          cleanTeamPlayer(
              shuffledGoalkeepers[0],
              true,
          ),
      );

      black.push(
          cleanTeamPlayer(
              shuffledGoalkeepers[1],
              true,
          ),
      );

      // Goleiros extras são distribuídos mantendo equilíbrio.
      shuffledGoalkeepers
          .slice(2)
          .forEach((player) => {
            const target =
              green.length <= black.length ?
                green :
                black;

            target.push(
                cleanTeamPlayer(
                    player,
                    true,
                ),
            );
          });

      // Restante dos jogadores é sorteado e balanceado.
      shuffledFieldPlayers.forEach((player) => {
        let target;

        if (green.length < black.length) {
          target = green;
        } else if (black.length < green.length) {
          target = black;
        } else {
          target =
            Math.random() < 0.5 ?
              green :
              black;
        }

        target.push(
            cleanTeamPlayer(
                player,
                false,
            ),
        );
      });

      const payload = {
        matchKey,
        green,
        black,
        total: selectedPlayers.length,
        goalkeeperRule: true,
        drawMode:
          String(request.data?.mode || "")
              .slice(0, 30),
        selectedPlayerIds:
          selectedPlayers.map(
              (player) => String(player.id),
          ),
        createdBy: request.auth.uid,
        createdAt: FieldValue.serverTimestamp(),
      };

      await db
          .collection("team_draws")
          .doc(matchKey)
          .set(payload, {merge: false});

      return {
        exists: true,
        matchKey,
        green,
        black,
        total: selectedPlayers.length,
      };
    },
);



exports.ajustarTimesRacha = onCall(
    {
      invoker: "public",
      region: "southamerica-east1",
      timeoutSeconds: 20,
    },
    async (request) => {
      unifiedAdminOrThrow(request);

      const matchKey =
        unifiedSafeMatchKey(
            request.data?.matchKey,
        );

      const playerId =
        String(
            request.data?.playerId || "",
        ).trim();

      const action =
        String(
            request.data?.action || "",
        ).trim();

      if (
        !matchKey ||
        !playerId ||
        action !== "switch"
      ) {
        throw new HttpsError(
            "invalid-argument",
            "Ajuste de time inválido.",
        );
      }

      const db = getFirestore();
      const ref =
        db.collection("team_draws")
            .doc(matchKey);

      const snapshot = await ref.get();

      if (!snapshot.exists) {
        throw new HttpsError(
            "failed-precondition",
            "Faça o sorteio antes de ajustar os times.",
        );
      }

      const data = snapshot.data() || {};

      const green =
        Array.isArray(data.green) ?
          [...data.green] :
          [];

      const black =
        Array.isArray(data.black) ?
          [...data.black] :
          [];

      let source = null;
      let target = null;
      let playerIndex = -1;

      playerIndex =
        green.findIndex(
            (item) =>
              String(item?.playerId || "") ===
              playerId,
        );

      if (playerIndex >= 0) {
        source = green;
        target = black;
      } else {
        playerIndex =
          black.findIndex(
              (item) =>
                String(item?.playerId || "") ===
                playerId,
          );

        if (playerIndex >= 0) {
          source = black;
          target = green;
        }
      }

      if (!source || playerIndex < 0) {
        throw new HttpsError(
            "not-found",
            "Jogador não encontrado nos times.",
        );
      }


      if (action === "switch") {
        const player = source[playerIndex];

        // Se for o único goleiro do time, troca com
        // um goleiro do outro time para preservar a regra.
        if (player?.isGoalkeeper === true) {
          const anotherKeeper =
            source.some(
                (item, index) =>
                  index !== playerIndex &&
                  item?.isGoalkeeper === true,
            );

          if (!anotherKeeper) {
            const otherKeeperIndex =
              target.findIndex(
                  (item) =>
                    item?.isGoalkeeper === true,
              );

            if (otherKeeperIndex < 0) {
              throw new HttpsError(
                  "failed-precondition",
                  "O outro time não possui goleiro para realizar a troca.",
              );
            }

            const otherKeeper =
              target[otherKeeperIndex];

            source[playerIndex] =
              otherKeeper;

            target[otherKeeperIndex] =
              player;
          } else {
            source.splice(playerIndex, 1);
            target.push(player);
          }
        } else {
          source.splice(playerIndex, 1);
          target.push(player);
        }
      }

      const total =
        green.length +
        black.length;

      await ref.set(
          {
            green,
            black,
            total,
            goalkeeperRule: true,
            manualAdjusted: true,
            updatedBy: request.auth.uid,
            updatedAt:
              FieldValue.serverTimestamp(),
          },
          {merge: true},
      );

      return {
        exists: true,
        matchKey,
        green,
        black,
        total,
        manualAdjusted: true,
      };
    },
);


exports.obterTimesRacha = onCall(
    {
      invoker: "public",
      region: "southamerica-east1",
      timeoutSeconds: 20,
    },
    async (request) => {
      unifiedAuthOrThrow(request);

      const matchKey =
        unifiedSafeMatchKey(
            request.data?.matchKey,
        );

      if (!matchKey) {
        return {
          exists: false,
          green: [],
          black: [],
          total: 0,
        };
      }

      const db = getFirestore();
      const snapshot =
        await db
            .collection("team_draws")
            .doc(matchKey)
            .get();

      if (!snapshot.exists) {
        return {
          exists: false,
          matchKey,
          green: [],
          black: [],
          total: 0,
        };
      }

      const data = snapshot.data() || {};

      return {
        exists: true,
        matchKey,
        green: Array.isArray(data.green) ? data.green : [],
        black: Array.isArray(data.black) ? data.black : [],
        total: Number(data.total || 0),
      };
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
      invoker: "public",
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
      invoker: "public",
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
      invoker: "public",
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
      invoker: "public",
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

      const mediaUrl =
        safeContentString(
            request.data?.mediaUrl,
            1200,
        );

      const mediaPath =
        safeContentString(
            request.data?.mediaPath,
            500,
        );

      const mediaType =
        safeContentString(
            request.data?.mediaType,
            20,
        );

      const mediaMimeType =
        safeContentString(
            request.data?.mediaMimeType,
            120,
        );

      const mediaFileName =
        safeContentString(
            request.data?.mediaFileName,
            120,
        );

      const mediaSize =
        Number(request.data?.mediaSize || 0);

      if (
        title.length < 3 ||
        text.length < 3
      ) {
        throw new HttpsError(
            "invalid-argument",
            "Título e texto são obrigatórios.",
        );
      }

      if (
        mediaUrl ||
        mediaPath ||
        mediaType
      ) {
        if (
          !mediaUrl ||
          !mediaPath ||
          !["image", "video"].includes(mediaType) ||
          !mediaPath.startsWith("notices/")
        ) {
          throw new HttpsError(
              "invalid-argument",
              "Mídia do comunicado inválida.",
          );
        }
      }

      const db = getFirestore();

      const ref =
        await db
            .collection("notices")
            .add({
              title,
              text,
              mediaUrl,
              mediaPath,
              mediaType,
              mediaMimeType,
              mediaFileName,
              mediaSize:
                Number.isFinite(mediaSize) ?
                  Math.max(0, mediaSize) :
                  0,
              createdBy: request.auth.uid,
              createdAt:
                FieldValue.serverTimestamp(),
            });

      let pushSent = 0;
      let pushFailed = 0;

      try {
        const playersSnapshot =
          await db
              .collection("players")
              .get();

        // GREEN PARK PUSH DELIVERY V2
        // Mantém a relação token -> jogador para remover somente
        // tokens que o Firebase confirmar como definitivamente inválidos.
        const tokenOwners = new Map();
        const deadTokensByPlayer = new Map();

        playersSnapshot.docs.forEach((docSnap) => {
          if (docSnap.id === GREEN_PARK_ADMIN_UID_CONTENT) {
            return;
          }

          const data = docSnap.data() || {};

          if (data.notificationsEnabled !== true) {
            return;
          }

          collectFcmTokens(data).forEach((token) => {
            if (!tokenOwners.has(token)) {
              tokenOwners.set(token, []);
            }

            tokenOwners.get(token).push(docSnap.ref);
          });
        });

        const tokenList = [...tokenOwners.keys()];

        const noticeUrl =
          GREENPARK_APP_URL +
          "?open=notice&noticeId=" +
          encodeURIComponent(ref.id);

        for (let index = 0; index < tokenList.length; index += 500) {
          const batchTokens = tokenList.slice(index, index + 500);

          const response = await getMessaging().sendEachForMulticast({
            tokens: batchTokens,
            notification: {
              title: "GREEN PARK FC • " + title,
              body: text.slice(0, 180),
            },
            data: {
              type: "notice",
              noticeId: ref.id,
              url: noticeUrl,
            },
            webpush: {
              headers: {
                Urgency: "high",
                TTL: "300",
              },
              fcmOptions: {
                link: noticeUrl,
              },
            },
          });

          response.responses.forEach((item, responseIndex) => {
            if (item.success) {
              return;
            }

            const failedToken =
              batchTokens[responseIndex] || "";

            const errorCode =
              item.error?.code || "sem-codigo";

            console.warn(
                "Push comunicado falhou:",
                "token=" +
                  failedToken.slice(0, 12) +
                  "...",
                "code=" +
                  errorCode,
                "message=" +
                  (item.error?.message || "sem-mensagem"),
            );

            // Só removemos automaticamente quando o próprio
            // Firebase declara que aquele registro não existe mais.
            if (
              errorCode ===
              "messaging/registration-token-not-registered"
            ) {
              const owners =
                tokenOwners.get(failedToken) || [];

              owners.forEach((playerRef) => {
                const playerKey = playerRef.path;

                if (!deadTokensByPlayer.has(playerKey)) {
                  deadTokensByPlayer.set(
                      playerKey,
                      {
                        ref: playerRef,
                        tokens: new Set(),
                      },
                  );
                }

                deadTokensByPlayer
                    .get(playerKey)
                    .tokens
                    .add(failedToken);
              });
            }
          });

          pushSent += response.successCount || 0;
          pushFailed += response.failureCount || 0;
        }

        // Limpeza controlada:
        // não apaga jogador, não desativa notificações e
        // não remove nenhum token que não tenha sido confirmado
        // como NotRegistered pelo Firebase.
        for (
          const cleanup of
          deadTokensByPlayer.values()
        ) {
          try {
            const playerSnapshot =
              await cleanup.ref.get();

            if (!playerSnapshot.exists) {
              continue;
            }

            const playerData =
              playerSnapshot.data() || {};

            const currentTokens =
              collectFcmTokens(playerData);

            const remainingTokens =
              currentTokens.filter(
                  (token) =>
                    !cleanup.tokens.has(token),
              );

            const currentPrimary =
              String(
                  playerData.fcmToken || "",
              ).trim();

            const patch = {
              fcmTokens: remainingTokens,
              notificationUpdatedAt:
                FieldValue.serverTimestamp(),
            };

            if (
              currentPrimary &&
              cleanup.tokens.has(currentPrimary)
            ) {
              patch.fcmToken =
                remainingTokens.length ?
                  remainingTokens[
                      remainingTokens.length - 1
                  ] :
                  FieldValue.delete();
            }

            await cleanup.ref.set(
                patch,
                {merge: true},
            );

            console.log(
                "Tokens Push inválidos removidos:",
                cleanup.ref.id,
                "removidos=" +
                  cleanup.tokens.size,
                "restantes=" +
                  remainingTokens.length,
            );
          } catch (cleanupError) {
            console.warn(
                "Falha limpando token Push inválido:",
                cleanup.ref.id,
                cleanupError?.message ||
                  cleanupError,
            );
          }
        }
      } catch (pushError) {
        console.error(
            "Falha ao enviar push do comunicado:",
            pushError,
        );
      }

      return {
        ok: true,
        id: ref.id,
        pushSent,
        pushFailed,
      };
    },
);

exports.listarComunicados = onCall(
    {
      invoker: "public",
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
            mediaUrl:
              safeContentString(
                  data.mediaUrl,
                  1200,
              ),
            mediaPath:
              safeContentString(
                  data.mediaPath,
                  500,
              ),
            mediaType:
              safeContentString(
                  data.mediaType,
                  20,
              ),
            mediaMimeType:
              safeContentString(
                  data.mediaMimeType,
                  120,
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
      invoker: "public",
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
        db.collection("notices").doc(id);
      const snapshot =
        await ref.get();

      if (!snapshot.exists) {
        return {ok: true};
      }

      const data = snapshot.data() || {};

      await deleteStoragePathIfExists(
          data.mediaPath,
      );

      await ref.delete();

      return {ok: true};
    },
);


// ============================================================
// PATROCINADORES
// ============================================================

exports.salvarPatrocinador = onCall(
    {
      invoker: "public",
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
      invoker: "public",
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
      invoker: "public",
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
        slot < 1
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
          data.dailyPrice || 13,
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
      invoker: "public",
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
      invoker: "public",
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
              if (docSnap.id === GREEN_PARK_ADMIN_UID_FINANCE) {
                return null;
              }

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
                photoURL:
                  financeString(
                      data.photoURL,
                      2000,
                  ),
                position:
                  data.position ===
                    "goalkeeper" ?
                    "goalkeeper" :
                    "field",
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
                  item &&
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
      invoker: "public",
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
      invoker: "public",
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


exports.registrarReceita = onCall(
    {
      invoker: "public",
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
                ?.method ||
              "Pix",
            30,
        );

      if (
        description.length < 2 ||
        amount <= 0
      ) {
        throw new HttpsError(
            "invalid-argument",
            "Descrição e valor da receita são obrigatórios.",
        );
      }

      const db =
        getFirestore();

      const ref =
        await db
            .collection(
                "finance_receipts",
            )
            .add(
                {
                  name:
                    description,
                  description,
                  amount,
                  type:
                    "manual",
                  category,
                  method,
                  status:
                    "approved",
                  manual:
                    true,
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
        amount,
      };
    },
);


exports.registrarDespesa = onCall(
    {
      invoker: "public",
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
      invoker: "public",
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
      invoker: "public",
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


      // PACOTE 18B MENSALISTA:
      // Mensalista tambem nao entra acima da lotacao.
      const [
        rachaSnapshotP18,
        confirmedSnapshotP18,
      ] = await Promise.all([
        db
            .collection("racha")
            .doc("current")
            .get(),
        db
            .collection("players")
            .where("status", "==", "confirmed")
            .get(),
      ]);

      const rachaDataP18 =
        rachaSnapshotP18.exists ?
          rachaSnapshotP18.data() || {} :
          {};

      const maxPlayersP18 =
        Math.max(
            1,
            Number(rachaDataP18.maxPlayers) || 40,
        );

      const alreadyConfirmedP18 =
        confirmedSnapshotP18.docs.some(
            (docSnap) =>
              docSnap.id === request.auth.uid,
        );

      if (
        !alreadyConfirmedP18 &&
        confirmedSnapshotP18.size >=
        maxPlayersP18
      ) {
        throw new HttpsError(
            "resource-exhausted",
            "Racha lotado. No momento não há vagas disponíveis.",
        );
      }

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

      greenParkRequirePlayerPhoto(
          data,
      );

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
      invoker: "public",
      region:
        "southamerica-east1",
      timeoutSeconds: 90,
    },
    async (request) => {
      financeAdminOrThrow(
          request,
      );

      const db =
        getFirestore();

      const playersSnapshot =
        await db
            .collection("players")
            .get();

      const players =
        playersSnapshot.docs.filter(
            (docSnap) =>
              docSnap.id !==
              GREEN_PARK_ADMIN_UID_FINANCE,
        );

      const confirmedBefore =
        players.filter(
            (docSnap) =>
              String(
                  docSnap.data()
                      ?.status || "",
              ).toLowerCase() ===
              "confirmed",
        ).length;

      // Primeiro passe: zera a presença de TODOS os jogadores,
      // preservando cadastro, foto, posição, plano e histórico.
      for (
        let index = 0;
        index < players.length;
        index += 350
      ) {
        const batch =
          db.batch();

        players
            .slice(
                index,
                index + 350,
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
                        paymentReported:
                          false,
                        paymentType:
                          "",
                        pixOrderId:
                          "",
                        pixStatus:
                          "",
                        pixProvider:
                          "",
                        paymentStatus:
                          FieldValue
                              .delete(),
                        paymentOrderId:
                          FieldValue
                              .delete(),
                        paymentProvider:
                          FieldValue
                              .delete(),
                        confirmedAt:
                          FieldValue
                              .delete(),
                        attendanceResetAt:
                          FieldValue
                              .serverTimestamp(),
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

      // Segundo passe: consulta diretamente quem ainda ficou confirmado.
      // Se houver qualquer sobra, força o reset novamente.
      let remainingSnapshot =
        await db
            .collection("players")
            .where(
                "status",
                "==",
                "confirmed",
            )
            .get();

      if (!remainingSnapshot.empty) {
        for (
          let index = 0;
          index < remainingSnapshot.docs.length;
          index += 350
        ) {
          const batch =
            db.batch();

          remainingSnapshot.docs
              .slice(
                  index,
                  index + 350,
              )
              .forEach(
                  (docSnap) => {
                    if (
                      docSnap.id ===
                      GREEN_PARK_ADMIN_UID_FINANCE
                    ) {
                      return;
                    }

                    batch.set(
                        docSnap.ref,
                        {
                          status:
                            "registered",
                          attendanceType:
                            "",
                          paymentReported:
                            false,
                          paymentType:
                            "",
                          pixOrderId:
                            "",
                          pixStatus:
                            "",
                          pixProvider:
                            "",
                          confirmedAt:
                            FieldValue
                                .delete(),
                          attendanceResetAt:
                            FieldValue
                                .serverTimestamp(),
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
      }

      // Verificação final no servidor.
      remainingSnapshot =
        await db
            .collection("players")
            .where(
                "status",
                "==",
                "confirmed",
            )
            .get();

      const confirmedAfter =
        remainingSnapshot.docs.filter(
            (docSnap) =>
              docSnap.id !==
              GREEN_PARK_ADMIN_UID_FINANCE,
        ).length;

      await db
          .collection("racha")
          .doc("current")
          .set(
              {
                confirmedCount:
                  confirmedAfter,
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
                resetVersion:
                  "v9.4",
              },
              {merge: true},
          );

      if (confirmedAfter !== 0) {
        throw new HttpsError(
            "internal",
            "O servidor ainda encontrou " +
            confirmedAfter +
            " jogador(es) confirmado(s) após o reset.",
        );
      }

      return {
        ok: true,
        playersPreserved:
          players.length,
        confirmedBefore,
        confirmedAfter,
        resetVersion:
          "v9.4",
      };
    },
);


exports.obterDashboardFinanceiro = onCall(
    {
      invoker: "public",
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
            if (docSnap.id === GREEN_PARK_ADMIN_UID_FINANCE) {
              return;
            }

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


// ============================================================================
// GREEN PARK FC - PACOTE 16
// WEBHOOK MERCADO PAGO FINAL E UNICO EXPORTADO
// ============================================================================

const MERCADO_PAGO_WEBHOOK_SECRET_P16 =
  defineSecret("MERCADO_PAGO_WEBHOOK_SECRET");

function mercadoPagoWebhookSignatureP16(req) {
  const xSignature =
    String(req.headers["x-signature"] || "").trim();

  const xRequestId =
    String(req.headers["x-request-id"] || "").trim();

  if (!xSignature) {
    return false;
  }

  let ts = "";
  let v1 = "";

  for (const part of xSignature.split(",")) {
    const pos = part.indexOf("=");

    if (pos === -1) {
      continue;
    }

    const key = part.substring(0, pos).trim();
    const value = part.substring(pos + 1).trim();

    if (key === "ts") {
      ts = value;
    } else if (key === "v1") {
      v1 = value;
    }
  }

  if (!ts || !/^[a-f0-9]{64}$/i.test(v1)) {
    return false;
  }

  const candidates = [];

  function addCandidate(value) {
    let id = String(value || "").trim();

    if (!id) {
      return;
    }

    if (/[a-zA-Z]/.test(id)) {
      id = id.toLowerCase();
    }

    if (!candidates.includes(id)) {
      candidates.push(id);
    }
  }

  addCandidate(req.query && req.query["data.id"]);
  addCandidate(req.query && req.query.data_id);
  addCandidate(req.body && req.body.data && req.body.data.id);

  try {
    const originalUrl = String(req.originalUrl || "");
    const qpos = originalUrl.indexOf("?");

    if (qpos !== -1) {
      const params =
        new URLSearchParams(originalUrl.substring(qpos + 1));

      addCandidate(params.get("data.id"));
      addCandidate(params.get("data_id"));
    }
  } catch (error) {
    console.warn(
        "P16 webhook: nao foi possivel ler query original.",
        error.message,
    );
  }

  if (!candidates.length) {
    candidates.push("");
  }

  const secret =
    MERCADO_PAGO_WEBHOOK_SECRET_P16.value();

  for (const id of candidates) {
    let manifest = "";

    if (id) {
      manifest += `id:${id};`;
    }

    if (xRequestId) {
      manifest += `request-id:${xRequestId};`;
    }

    manifest += `ts:${ts};`;

    const calculated =
      crypto
          .createHmac("sha256", secret)
          .update(manifest)
          .digest("hex");

    if (calculated.length !== v1.length) {
      continue;
    }

    const valid =
      crypto.timingSafeEqual(
          Buffer.from(calculated, "hex"),
          Buffer.from(v1, "hex"),
      );

    if (valid) {
      return true;
    }
  }

  return false;
}

exports.mercadoPagoWebhook = onRequest(
    {
      region: "southamerica-east1",
      secrets: [
        MERCADO_PAGO_ACCESS_TOKEN,
        MERCADO_PAGO_WEBHOOK_SECRET_P16,
      ],
      timeoutSeconds: 30,
    },
    async (req, res) => {
      if (req.method !== "POST") {
        return res.status(200).send("ok");
      }

      if (!mercadoPagoWebhookSignatureP16(req)) {
        console.warn(
            "P16 webhook rejeitado: assinatura invalida.",
        );

        return res
            .status(401)
            .send("assinatura invalida");
      }

      const body = req.body || {};

      let orderId =
        String(
            body?.data?.id ||
            req.query?.["data.id"] ||
            req.query?.data_id ||
            "",
        ).trim();

      if (!orderId) {
        try {
          const originalUrl =
            String(req.originalUrl || "");

          const pos =
            originalUrl.indexOf("?");

          if (pos !== -1) {
            const params =
              new URLSearchParams(
                  originalUrl.substring(pos + 1),
              );

            orderId =
              String(
                  params.get("data.id") ||
                  params.get("data_id") ||
                  "",
              ).trim();
          }
        } catch (error) {
          console.warn(
              "P16 webhook: falha lendo orderId.",
              error.message,
          );
        }
      }

      if (!orderId) {
        return res.status(200).send("ok");
      }

      try {
        const db = getFirestore();

        const savedOrderRef =
          db.collection("pix_orders").doc(orderId);

        const savedOrder =
          await savedOrderRef.get();

        if (!savedOrder.exists) {
          console.log(
              "P16 webhook: order externa/nao cadastrada ignorada:",
              orderId,
          );

          return res.status(200).send("ok");
        }

        const savedData =
          savedOrder.data() || {};

        const userId =
          String(savedData.userId || "").trim();

        if (!userId) {
          console.error(
              "P16 webhook: order sem userId:",
              orderId,
          );

          return res.status(200).send("ok");
        }

        if (savedData.webhookConfirmed === true) {
          console.log(
              "P16 webhook: order ja confirmada:",
              orderId,
          );

          return res.status(200).send("ok");
        }

        const response =
          await fetch(
              "https://api.mercadopago.com/v1/orders/" +
              encodeURIComponent(orderId),
              {
                method: "GET",
                headers: {
                  "Authorization":
                    "Bearer " +
                    MERCADO_PAGO_ACCESS_TOKEN.value(),
                  "Accept": "application/json",
                },
              },
          );

        const order =
          await response.json();

        if (!response.ok) {
          console.error(
              "P16 webhook: erro consultando Mercado Pago:",
              response.status,
              orderId,
          );

          if (response.status >= 500) {
            return res.status(500).send("retry");
          }

          return res.status(200).send("ok");
        }

        const payments =
          Array.isArray(order.transactions?.payments) ?
            order.transactions.payments :
            [];

        const payment =
          payments[0] || {};

        const paid =
          (
            order.status === "processed" &&
            order.status_detail === "accredited"
          ) ||
          (
            payment.status === "processed" &&
            payment.status_detail === "accredited"
          );

        if (!paid) {
          return res.status(200).send("ok");
        }

        const savedExternal =
          String(savedData.externalReference || "").trim();

        const apiExternal =
          String(order.external_reference || "").trim();

        if (
          savedExternal &&
          apiExternal &&
          savedExternal !== apiExternal
        ) {
          console.error(
              "P16 webhook: external_reference divergente:",
              orderId,
          );

          return res.status(200).send("ok");
        }

        const expectedAmount =
          Number(savedData.amount || 0);

        const apiAmount =
          Number(
              payment.amount ||
              order.total_amount ||
              0,
          );

        if (
          expectedAmount > 0 &&
          apiAmount > 0 &&
          Math.abs(expectedAmount - apiAmount) > 0.001
        ) {
          console.error(
              "P16 webhook: valor divergente:",
              orderId,
              expectedAmount,
              apiAmount,
          );

          return res.status(200).send("ok");
        }

        const playerRef =
          db.collection("players").doc(userId);

        const playerSnapshot =
          await playerRef.get();

        const playerData =
          playerSnapshot.exists ?
            playerSnapshot.data() || {} :
            {};

        const paidType =
          savedData.type === "monthly" ?
            "monthly" :
            "daily";

        const playerPatch = {
          status: "confirmed",
          paymentStatus: "approved",
          paymentProvider: "mercadopago",
          paymentOrderId: orderId,
          paymentType: paidType,
          attendanceType: paidType,
          confirmedAt:
            playerData.confirmedAt ||
            FieldValue.serverTimestamp(),
          updatedAt:
            FieldValue.serverTimestamp(),
        };

        if (paidType === "monthly") {
          playerPatch.billingType =
            "monthly";

          playerPatch.monthlyPaidThrough =
            financeSaoPauloParts().monthKey;
        }

        await playerRef.set(
            playerPatch,
            {merge: true},
        );

        await savedOrderRef.set(
            {
              status: "processed",
              statusDetail: "accredited",
              confirmed: true,
              webhookConfirmed: true,
              webhookConfirmedAt:
                FieldValue.serverTimestamp(),
            },
            {merge: true},
        );

        await atualizarContagemRacha(db);

        try {
          await sendPixConfirmedPushes(db, {
            orderId,
            userId,
            playerData,
            includeAdmin: true,
            includePlayer: true,
          });
        } catch (pushError) {
          console.warn(
              "P16 webhook: pagamento aprovado, push falhou:",
              pushError.message,
          );
        }

        console.log(
            "P16 PAGAMENTO CONFIRMADO:",
            orderId,
            userId,
        );

        return res.status(200).send("ok");
      } catch (error) {
        console.error(
            "P16 webhook erro:",
            error,
        );

        return res.status(500).send("erro");
      }
    },
);

// ============================================================================
// GREEN PARK FC - PACOTE 17
// SEGUNDA CAMADA DE CONFIRMACAO PIX
// Webhook continua sendo o caminho principal.
// Esta rotina cobre notificacoes perdidas ou atraso de entrega.
// ============================================================================

const {
  onSchedule: onScheduleP17,
} = require("firebase-functions/v2/scheduler");


async function p17ReconcileOnePix(db, docSnap) {
  const savedData = docSnap.data() || {};
  const orderId = docSnap.id;

  if (
    savedData.confirmed === true ||
    savedData.webhookConfirmed === true
  ) {
    return false;
  }

  const userId =
    String(savedData.userId || "").trim();

  if (!userId) {
    return false;
  }

  const response =
    await fetch(
        "https://api.mercadopago.com/v1/orders/" +
        encodeURIComponent(orderId),
        {
          method: "GET",
          headers: {
            "Authorization":
              "Bearer " +
              MERCADO_PAGO_ACCESS_TOKEN.value(),
            "Accept": "application/json",
          },
        },
    );

  if (!response.ok) {
    console.warn(
        "P17 reconcile API:",
        orderId,
        response.status,
    );
    return false;
  }

  const order =
    await response.json();

  const payments =
    Array.isArray(
        order.transactions?.payments,
    ) ?
      order.transactions.payments :
      [];

  const payment =
    payments[0] || {};

  const paid =
    (
      order.status === "processed" &&
      order.status_detail === "accredited"
    ) ||
    (
      payment.status === "processed" &&
      payment.status_detail === "accredited"
    );

  if (!paid) {
    return false;
  }

  const expectedAmount =
    Number(savedData.amount || 0);

  const actualAmount =
    Number(
        payment.amount ||
        order.total_amount ||
        0,
    );

  if (
    expectedAmount > 0 &&
    actualAmount > 0 &&
    Math.abs(
        expectedAmount - actualAmount,
    ) > 0.001
  ) {
    console.error(
        "P17 valor divergente:",
        orderId,
        expectedAmount,
        actualAmount,
    );
    return false;
  }

  const savedExternal =
    String(
        savedData.externalReference || "",
    ).trim();

  const apiExternal =
    String(
        order.external_reference || "",
    ).trim();

  if (
    savedExternal &&
    apiExternal &&
    savedExternal !== apiExternal
  ) {
    console.error(
        "P17 external_reference divergente:",
        orderId,
    );
    return false;
  }

  const playerRef =
    db.collection("players").doc(userId);

  const playerSnapshot =
    await playerRef.get();

  if (!playerSnapshot.exists) {
    return false;
  }

  const playerData =
    playerSnapshot.data() || {};

  const paidType =
    savedData.type === "monthly" ?
      "monthly" :
      "daily";

  const patch = {
    status: "confirmed",
    paymentStatus: "approved",
    paymentProvider: "mercadopago",
    paymentOrderId: orderId,
    paymentType: paidType,
    attendanceType: paidType,
    confirmedAt:
      playerData.confirmedAt ||
      FieldValue.serverTimestamp(),
    updatedAt:
      FieldValue.serverTimestamp(),
  };

  if (paidType === "monthly") {
    patch.billingType = "monthly";
    patch.monthlyPaidThrough =
      financeSaoPauloParts().monthKey;
  }

  await playerRef.set(
      patch,
      {merge: true},
  );

  await docSnap.ref.set(
      {
        status: "processed",
        statusDetail: "accredited",
        paid: true,
        confirmed: true,
        webhookConfirmed: true,
        reconciliationSource:
          "p17_scheduled_mp_verification",
        reconciledAt:
          FieldValue.serverTimestamp(),
        updatedAt:
          FieldValue.serverTimestamp(),
      },
      {merge: true},
  );

  await atualizarContagemRacha(db);

  try {
    await sendPixConfirmedPushes(db, {
      orderId,
      userId,
      playerData,
      includeAdmin: true,
      includePlayer: true,
    });
  } catch (error) {
    console.warn(
        "P17 reconcile push:",
        orderId,
        error.message,
    );
  }

  console.log(
      "P17 PIX RECONCILIADO:",
      orderId,
      userId,
  );

  return true;
}


exports.reconciliarPixPendentes =
  onScheduleP17(
      {
        schedule: "every 1 minutes",
        region: "southamerica-east1",
        secrets: [
          MERCADO_PAGO_ACCESS_TOKEN,
        ],
        timeoutSeconds: 60,
        maxInstances: 1,
      },
      async () => {
        const db = getFirestore();
        const snapshot =
          await db
              .collection("pix_orders")
              .get();

        const now = Date.now();
        const maxAge =
          2 * 60 * 60 * 1000;

        const candidates =
          snapshot.docs
              .filter((docSnap) => {
                const d =
                  docSnap.data() || {};

                if (
                  d.confirmed === true ||
                  d.webhookConfirmed === true
                ) {
                  return false;
                }

                const ts =
                  d.updatedAt ||
                  d.createdAt;

                if (
                  ts &&
                  typeof ts.toMillis ===
                    "function"
                ) {
                  return (
                    now - ts.toMillis() <=
                    maxAge
                  );
                }

                return true;
              })
              .slice(0, 50);

        let repaired = 0;

        for (
          const docSnap of candidates
        ) {
          try {
            const ok =
              await p17ReconcileOnePix(
                  db,
                  docSnap,
              );

            if (ok) {
              repaired++;
            }
          } catch (error) {
            console.warn(
                "P17 reconcile erro:",
                docSnap.id,
                error.message,
            );
          }
        }

        console.log(
            "P17 reconciliacao:",
            "candidatos=" +
              candidates.length,
            "confirmados=" +
              repaired,
        );
      },
  );
