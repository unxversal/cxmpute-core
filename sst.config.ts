// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "cxmpute-core",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
    };
  },
  async run() {
    new sst.aws.Nextjs("CxmputeWebsite",{
      domain: {
        name: "cxmpute.cloud",
        redirects: ["www." + "cxmpute.cloud"],
      }
    });
    
  },
});
