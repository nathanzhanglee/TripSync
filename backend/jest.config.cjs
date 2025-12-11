module.exports = {
    testEnvironment: "node",
    collectCoverage: true,
    collectCoverageFrom: [
        "routes/destinations.js",
        "routes/recommendations.js"
    ],
    coverageThreshold: {
        global: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
        }
    }
};
  