require("dotenv").config();
const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const { Client, middleware } = require("@line/bot-sdk");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const lineConfig = {
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.CHANNEL_SECRET,
};

const lineClient = new Client(lineConfig);

const app = express();

app.use(express.json());
app.use(
    express.urlencoded({
        extended: true,
    }),
);

app.post("/webhook", async (req, res) => {
    try {
        const { events } = req.body;

        for (const event of events) {
            if (
                event.type === "message" &&
                event.message.type === "text" &&
                event.message.text === "สู้ต่อไป"
            ) {
                const { data: passports, error } = await supabase
                    .from("passports")
                    .select(
                        "first_name,last_name,passport_number,visa_date,agency",
                    );

                if (error) {
                    throw new Error(error.message);
                }

                for (const passport of passports) {
                    const {
                        first_name,
                        last_name,
                        passport_number,
                        visa_date,
                        agency,
                    } = passport;

                    const message = {
                        type: "text",
                        text: `แจ้งเตือนวีซ่า ${passport_number} ใกล้หมดอายุ\nName-Surname: ${first_name} ${last_name}\nPassport No.: ${passport_number}\nExpired date: ${visa_date}\nAgent: ${agency}`,
                    };

                    console.log(message);

                    await lineClient.replyMessage(event.replyToken, message);
                }
            }
        }

        res.status(200).end();
    } catch (error) {
        console.error("Error handling Line Bot event:", error);
        res.status(500).end();
    }
});

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});
