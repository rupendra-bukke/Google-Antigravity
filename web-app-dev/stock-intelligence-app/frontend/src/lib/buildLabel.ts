const APP_BRANCH =
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF ||
    process.env.NEXT_PUBLIC_GIT_BRANCH ||
    "";
const APP_CHANNEL_RAW = process.env.NEXT_PUBLIC_APP_CHANNEL || APP_BRANCH;
const APP_CHANNEL = /^(main|master|prod|production)$/i.test(APP_CHANNEL_RAW) ? "Main" : "Dev";
const APP_GIT_SHA =
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_GIT_SHA ||
    "";
const BUILD_COMMIT = APP_GIT_SHA ? APP_GIT_SHA.slice(0, 7).toUpperCase() : "LOCAL";

export const BUILD_LABEL = `${APP_CHANNEL} | ${BUILD_COMMIT}`;
