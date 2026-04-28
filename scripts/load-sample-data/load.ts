import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { MessageFilterContext } from "@/lib/types/messageFilterContext";
import { getModelFactory } from "../../lib/models";
import { logger } from "@/lib/logging/server";
import { processMessages } from "./process-messages";

async function loadSampleData() {
    try {
        const modelFactory = getModelFactory();
        await modelFactory.initialize();

        const dataDir = join(__dirname, "data");
        const messagesDir = join(dataDir, "messages");

        const messagesFiles = readdirSync(messagesDir).map((file) =>
            JSON.parse(readFileSync(join(messagesDir, file), "utf-8"))
        );

        const getRandomFile = () => {
            const totalWeight = messagesFiles.reduce((sum, file) => sum + file.weight, 0);
            const random = Math.random() * totalWeight;
            let weightSum = 0;
            return (
                messagesFiles.find((file) => {
                    weightSum += file.weight;
                    return random < weightSum;
                }) || messagesFiles[messagesFiles.length - 1]
            );
        };

        const sessionData = [
            { user: "bob", weight: 4 },
            { user: "alice", weight: 2 },
            { user: "dev", weight: 1 },
        ];

        const getRandomSession = () => {
            const totalWeight = sessionData.reduce((sum, session) => sum + session.weight, 0);
            const random = Math.random() * totalWeight;
            let weightSum = 0;
            return (
                sessionData.find((session) => {
                    weightSum += session.weight;
                    return random < weightSum;
                }) || sessionData[sessionData.length - 1]
            );
        };

        for (const file of messagesFiles) {
            logger.debug(`Got file ${file.file} with weight ${file.weight}`);
        }

        let totalFiles = 0;
        let totalMessageCount = 0;
        let replayBatchSeq = 0;

        const daysOfData = 60;

        logger.info(
            `Loading ${daysOfData} days of data, ${messagesFiles.length} transcript files (Arcade-style replay)`
        );

        const now = new Date();
        let processingDate = new Date(now.getTime() - daysOfData * 24 * 60 * 60 * 1000);
        while (processingDate < now) {
            const data = getRandomFile();
            logger.info(`Processing toolkit ${data.server} (${data.file}) at ${processingDate}`);
            totalFiles++;

            const selectedSession = getRandomSession();
            const toolkit = typeof data.server === "string" ? data.server : "sample";
            const filterContext: MessageFilterContext = {
                user: selectedSession.user,
                source: "arcade",
                payloadToolkit: toolkit,
                payloadToolVersion: "1.0.0",
            };
            replayBatchSeq += 1;
            const messageCount = await processMessages(
                filterContext,
                data.messages,
                processingDate,
                replayBatchSeq
            );
            totalMessageCount += messageCount;
            logger.debug(`Loaded ${messageCount} messages from ${data.file}`);
            processingDate = new Date(processingDate.getTime() + Math.random() * 60 * 60 * 1000);
        }

        logger.info(`Loaded ${totalMessageCount} messages from ${totalFiles} file runs`);

        logger.debug("Running ANALYZE to optimize query performance...");
        await modelFactory.analyze();
        logger.debug("ANALYZE completed");

        process.exit(0);
    } catch (error) {
        logger.error("Error loading sample data:", error);
        process.exit(1);
    }
}

loadSampleData();
