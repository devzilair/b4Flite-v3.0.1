import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
    /* config options here */
    typescript: {
        ignoreBuildErrors: true, // Temporary during migration
    },
    // eslint configuration in next.config.ts is no longer supported in some versions,
    // let's rely on .eslintignore if needed, or keeping it disabled here if TS allowed.
    // However, the error said it's unrecognized. Removing it.
};

export default withSentryConfig(nextConfig, {
    // For all available options, see:
    // https://github.com/getsentry/sentry-webpack-plugin#options

    // Suppresses source map uploading logs during bundling
    silent: true,
    org: "zilair",
    project: "staff-portal",
});
