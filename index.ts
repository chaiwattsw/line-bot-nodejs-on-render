import "dotenv/config";
import {
    ClientConfig,
    Client,
    middleware,
    MiddlewareConfig,
    WebhookEvent,
    TextMessage,
    MessageAPIResponseBase,
} from "@line/bot-sdk";
import express, { Application, Request, Response } from "express";
import {
    createClient,
    SupabaseClient,
    PostgrestResponse,
} from "@supabase/supabase-js";

// Setup all LINE client and Express configurations.
const clientConfig: ClientConfig = {
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || "",
    channelSecret: process.env.CHANNEL_SECRET || "",
};

const middlewareConfig: MiddlewareConfig = {
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || "",
    channelSecret: process.env.CHANNEL_SECRET || "",
};

const PORT = process.env.PORT || 3000;

// Create a new LINE SDK client.
const client = new Client(clientConfig);

// Create a new Express application.
const app: Application = express();

// Create a new Supabase client.
const supabaseUrl = "YOUR_SUPABASE_URL";
const supabaseKey = "YOUR_SUPABASE_KEY";
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// Function to fetch the passport data from Supabase.
const fetchPassportData = async (): Promise<PostgrestResponse<any> | null> => {
    try {
        const { data, error } = await supabase
            .from("passports")
            .select("first_name, last_name, visa_date");

        if (error) {
            console.error(error);
            return null;
        }

        return data;
    } catch (error) {
        console.error(error);
        return null;
    }
};

// Function handler to process the text event.
const textEventHandler = async (
    event: WebhookEvent,
): Promise<MessageAPIResponseBase | undefined> => {
    // Process all variables here.
    if (event.type !== "message" || event.message.type !== "text") {
        return;
    }

    // Fetch the passport data from Supabase.
    const passportData = await fetchPassportData();

    // Check if passportData exists.
    if (passportData) {
        // Format the passport data into a string.
        const passportList = passportData
            .map((passport: any) => {
                const { first_name, last_name, visa_date } = passport;
                return `${first_name} ${last_name} - ${visa_date}`;
            })
            .join("\n");

        // Create a response message.
        const response: TextMessage = {
            type: "text",
            text: passportList,
        };

        // Reply to the user.
        await client.replyMessage(event.replyToken, response);
    }
};

// Register the LINE middleware.
app.use(middleware(middlewareConfig));

// Route handler to receive webhook events.
app.post("/webhook", async (req: Request, res: Response): Promise<Response> => {
    const events: WebhookEvent[] = req.body.events;

    // Process all of the received events asynchronously.
    const results = await Promise.all(
        events.map(async (event: WebhookEvent) => {
            try {
                await textEventHandler(event);
            } catch (err: unknown) {
                if (err instanceof Error) {
                    console.error(err);
                }

                // Return an error message.
                return res.status(500).json({
                    status: "error",
                });
            }
        }),
    );

    // Return a successful message.
    return res.status(200).json({
        status: "success",
        results,
    });
});

// Create a server and listen to it.
app.listen(PORT, () => {
    console.log(`Application is live and listening on port ${PORT}`);
});
