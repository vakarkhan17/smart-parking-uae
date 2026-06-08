const express = require("express");

const router = express.Router();

let cachedToken = null;
let tokenExpiresAt = 0;

async function getDdaAccessToken() {
  const now = Date.now();

  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  const baseUrl = process.env.DDA_BASE_URL;
  const securityIdentifier = process.env.DDA_SECURITY_IDENTIFIER;
  const clientId = process.env.DDA_CLIENT_ID;
  const clientSecret = process.env.DDA_CLIENT_SECRET;

  if (!baseUrl || !securityIdentifier || !clientId || !clientSecret) {
    throw new Error("DDA credentials are missing in .env file");
  }

  const response = await fetch(
    `${baseUrl}/secure/ssis/dubaiai/gatewaytoken/1.0.0/getAccessToken`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-DDA-SecurityApplicationIdentifier": securityIdentifier,
      },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    console.error("DDA token error:", data);
    throw new Error("Failed to get DDA access token");
  }

  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + ((data.expires_in || 3600) - 60) * 1000;

  return cachedToken;
}

router.get("/health", async (req, res) => {
  try {
    const token = await getDdaAccessToken();

    const response = await fetch(
      `${process.env.DDA_BASE_URL}/secure/ddads/healthcheck/1.0.0/health`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("DDA health error:", error);
    return res.status(500).json({
      message: error.message || "DDA health check failed",
    });
  }
});

router.get("/parking-spaces", async (req, res) => {
  try {
    const token = await getDdaAccessToken();

    const page = req.query.page || 1;
    const pageSize = req.query.pageSize || 100;
    const zone = req.query.zone;

    const params = new URLSearchParams();
    params.set("page", page);
    params.set("pageSize", pageSize);

    if (zone) {
      params.set("filter", `zone=${zone}`);
    }

    const endpoint =
      process.env.DDA_PARKING_ENDPOINT ||
      "/open/rta/rta_number_of_parking_spaces_per_zone-open-api";

    const response = await fetch(
      `${process.env.DDA_BASE_URL}${endpoint}?${params.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    return res.status(response.status).json({
      source: "Digital Dubai / RTA",
      liveAvailability: false,
      note:
        "This dataset provides number of parking spaces per zone, not real-time available spaces.",
      data,
    });
  } catch (error) {
    console.error("DDA parking error:", error);
    return res.status(500).json({
      message: error.message || "Failed to fetch DDA parking data",
    });
  }
});

module.exports = router;