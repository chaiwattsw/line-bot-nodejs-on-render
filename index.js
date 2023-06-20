require("dotenv").config();
const express = require("express");
const { Client } = require("@line/bot-sdk");
const { createClient } = require("@supabase/supabase-js");
const cron = require("node-cron");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const isSameOrAfter = require("dayjs/plugin/isSameOrAfter");

dayjs.extend(utc);
dayjs.extend(isSameOrAfter);

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
    const events = req.body.events;

    for (const event of events) {
        if (
            event.type === "message" &&
            event.message.type === "text" &&
            event.message.text === "สู้ต่อไป"
        ) {
            try {
                console.log("SENDING MESSAGE...");
                await sendReminderMessages(event.replyToken); // Trigger the reminder job and pass the replyToken
                res.status(200).end();
            } catch (err) {
                console.error("Failed to send reminder messages:", err);
            }
        }
    }
});

// Define function to get passports to send reminders
async function getPassportsToSendReminders() {
    const currentDate = dayjs().utc(); // Get current UTC date and time
    const thirtyDaysLater = currentDate.add(30, "days");
    const fortyFiveDaysLater = currentDate.add(45, "days");

    // Query the passports table for records matching the conditions
    const { data, error } = await supabase
        .from("passports")
        .select("*")
        .limit(3); // Adjust the limit to retrieve three passports

    if (error) {
        console.error("Failed to retrieve passports:", error);
        return [];
    }

    console.log("DATA", data);

    return data || [];
}

// Define function to send reminder messages
async function sendReminderMessages(replyToken) {
    const passports = await getPassportsToSendReminders();

    if (passports.length === 0) {
        console.log("No passports to send reminders");
        return;
    }

    for (const passport of passports) {
        const flexMessage = {
            type: "flex",
            altText: "Visa Expiry Reminder",
            contents: {
                type: "bubble",
                hero: {
                    type: "image",
                    url: "https://example.com/image.jpg",
                    size: "full",
                    aspectRatio: "16:9",
                    aspectMode: "cover",
                },
                body: {
                    type: "box",
                    layout: "vertical",
                    spacing: "md",
                    contents: [
                        {
                            type: "text",
                            text: `💀 แจ้งเตือนวีซ่า TR60\n${passport.passport_number}\nใกล้หมดอายุ 💀`,
                            weight: "bold",
                            size: "md",
                        },
                        {
                            type: "box",
                            layout: "vertical",
                            spacing: "sm",
                            contents: [
                                {
                                    type: "text",
                                    text: `❌ Name:\n${passport.first_name} ${passport.last_name}`,
                                    size: "md",
                                },
                                {
                                    type: "text",
                                    text: `❌ Passport No.:\n${passport.passport_number}`,
                                    size: "md",
                                },
                                {
                                    type: "text",
                                    text: `❌ Expired date:\n${passport.visa_date}`,
                                    size: "md",
                                },
                                {
                                    type: "text",
                                    text: `❌ Agency:\n${
                                        passport?.agency || "-"
                                    }`,
                                    size: "md",
                                },
                            ],
                        },
                    ],
                },
            },
        };

        try {
            // Send the message using the LINE Bot SDK or your preferred messaging service
            console.log("REPLYING...");
            await lineClient.replyMessage(replyToken, flexMessage); // Use lineClient.replyMessage instead
        } catch (err) {
            console.error(err);
        }
    }
}

// Schedule the sendReminderMessages function to run every day at 3:00 PM UTC
cron.schedule("0 15 * * *", () => {
    try {
        sendReminderMessages(); // Run the reminder job without a replyToken
    } catch (err) {
        console.error("Failed to send reminder messages:", err);
    }
}); // Runs once every day at 3:00 PM UTC

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});
