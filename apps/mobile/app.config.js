/** Expo Go needs explicit linking configuration, not a production app identity. */
module.exports = ({ config }) => {
  const development = process.env.APP_VARIANT === "development"
    && process.env.NODE_ENV !== "production";
  return {
    ...config,
    ...(development ? { scheme: "future-gym-dev" } : {}),
  };
};
