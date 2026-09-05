import { expect } from "chai";
import fs from "fs";
import path from "path";

describe("Notification-free capstone scope", () => {
  it("does not ship email templates, mail configuration, or mail packages", () => {
    const emailTemplateDirectory = path.join(process.cwd(), "src/core/global/shared/templates/email");
    const envExample = fs.readFileSync(path.join(process.cwd(), ".env.example"), "utf8");
    const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };

    const emailTemplates = fs.existsSync(emailTemplateDirectory)
      ? fs.readdirSync(emailTemplateDirectory).filter((file) => file.endsWith(".ts"))
      : [];
    expect(emailTemplates).to.deep.equal([]);
    expect(envExample).not.to.match(/^(SERVICE|HOST|SECURE|PORTMAIL|GATE_NOREPLY)=/m);
    expect(packageJson.dependencies).not.to.have.any.keys("handlebars", "nodemailer");
  });
});
