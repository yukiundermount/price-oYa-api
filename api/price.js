import { google } from "googleapis";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  try {
    const {
      category,
      brand,
      model,
      condition,
      year,
      accessories,
      strategy,
      images = []
    } = req.body;

    /** ========= Google Auth ========= */
    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      undefined,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      [
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/spreadsheets"
      ]
    );

    const drive = google.drive({ version: "v3", auth });
    const sheets = google.sheets({ version: "v4", auth });

    /** ========= Drive upload ========= */
    const uploadedUrls: string[] = [];

    for (let i = 0; i < images.length; i++) {
      const buffer = Buffer.from(images[i], "base64");

      const file = await drive.files.create({
        requestBody: {
          name: `price-o-ya_${Date.now()}_${i + 1}.jpg`,
          parents: [process.env.GOOGLE_DRIVE_FOLDER_ID]
        },
        media: {
          mimeType: "image/jpeg",
          body: buffer
        }
      });

      const fileId = file.data.id;

      // 誰でも閲覧可能にする
      await drive.permissions.create({
        fileId,
        requestBody: {
          role: "reader",
          type: "anyone"
        }
      });

      uploadedUrls.push(
        `https://drive.google.com/file/d/${fileId}/view`
      );
    }

    /** ========= AI査定（例） ========= */
    const price_buy = 1200000;
    const price_sell = 1500000;
    const profit_rate = (price_sell - price_buy) / price_buy;
    const confidence = 0.9;

    const reason =
      "2015年製のロレックス デイトナは人気が高く、新品状態かつ付属品完備のため、相場中央値を下回る価格での販売が可能。";

    /** ========= Sheets write ========= */
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: "Sheet1!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            new Date().toISOString(),
            category,
            brand,
            model,
            condition,
            year,
            accessories,
            strategy,
            uploadedUrls.join(","),   // imageUrls
            uploadedUrls.length,      // imageCount
            price_buy,
            price_sell,
            profit_rate,
            reason
          ]
        ]
      }
    });

    /** ========= Response ========= */
    return res.status(200).json({
      result: {
        price_buy,
        price_sell,
        profit_margin: profit_rate * 100,
        confidence: confidence * 100,
        reasoning: reason
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server error" });
  }
}

