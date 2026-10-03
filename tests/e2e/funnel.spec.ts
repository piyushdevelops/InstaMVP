import { test, expect } from "@playwright/test";
import { covers, CAMPAIGN } from "../../lib/covers";
test("complete voting, recover reward, join and attribute a referred signup", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "I’ve got this" }).click();
  for (let i = 0; i < 12; i++) {
    await page
      .getByRole("button", {
        name: i % 2 ? "Pass on this cover" : "Love this cover",
      })
      .click();
    await page.waitForTimeout(240);
  }
  await expect(page.locator(".favourites-grid li")).toHaveCount(6);
  await page
    .getByRole("button", { name: "Continue to my ₹500 reward" })
    .click();
  await page.getByLabel("Your first name").fill("Aanya");
  await page
    .getByLabel("Email address")
    .fill(`aanya-${Date.now()}@example.com`);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Unlock my ₹500" }).click();
  await expect(
    page.getByRole("heading", { name: "Good eye, Aanya." }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Good eye, Aanya." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Become a Taste Maker" }).click();
  await page.getByRole("button", { name: "Join & get my link" }).click();
  const link = await page.getByLabel("Your referral link").inputValue();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const friend = await context.newPage();
  await friend.goto(link);
  await friend.getByRole("button", { name: "I’ve got this" }).click();
  for (let i = 0; i < 12; i++) {
    await friend.getByRole("button", { name: "Love this cover" }).click();
    await friend.waitForTimeout(240);
  }
  await expect(friend.locator(".favourites-grid li")).toHaveCount(12);
  await friend
    .getByRole("button", { name: "Continue to my ₹500 reward" })
    .click();
  await friend.getByLabel("Your first name").fill("Riya");
  await friend
    .getByLabel("Email address")
    .fill(`riya-${Date.now()}@example.com`);
  await friend.getByRole("checkbox").check();
  await friend.getByRole("button", { name: "Unlock my ₹500" }).click();
  await expect(
    friend.getByRole("heading", { name: "Good eye, Riya." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Refresh my activity" }).click();
  await expect(page.locator(".stats>div").nth(0)).toContainText("1");
  await expect(page.locator(".stats>div").nth(1)).toContainText("1");
  await expect(page.locator(".stats>div").nth(2)).toContainText("0");
  await context.close();
});
test("undo persists, recap handles no favourites and preorder terms are explicit", async ({
  page,
}) => {
  await page.addInitScript(
    ({ key, ballot }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(ballot));
    },
    {
      key: `${CAMPAIGN}:votes`,
      ballot: covers.map((c) => ({ coverId: c.id, liked: false })),
    },
  );
  await page.goto("/");
  await expect(
    page.getByText("None of these felt right", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo last swipe" }).click();
  await expect(page.locator(".counter")).toContainText("12");
  await page.reload();
  await expect(page.locator(".counter")).toContainText("12");
  await page.getByRole("button", { name: "Love this cover" }).click();
  await expect(page.locator(".favourites-grid li")).toHaveCount(1);
  await expect(page.locator(".favourites-grid")).toContainText("New chapter");
  await page
    .getByRole("button", { name: "Continue to my ₹500 reward" })
    .click();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByLabel("Phone", { exact: false })).toBeVisible();
  await expect(
    page.getByText("During preorders only · exact dates to be announced"),
  ).toBeVisible();
  await expect(
    page.getByText("Just for our cover voters", { exact: false }),
  ).toContainText("March 2027");
});
test("progress resumes, mobile page fits, and foreign-origin writes fail", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "I’ve got this" }).click();
  await page.getByRole("button", { name: "Love this cover" }).click();
  await page.waitForTimeout(300);
  await page.reload();
  await expect(page.locator(".counter")).toContainText("02");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const res = await request.post("/api/participants", {
    headers: { Origin: "https://evil.example" },
    data: {},
  });
  expect(res.status()).toBe(403);
});
