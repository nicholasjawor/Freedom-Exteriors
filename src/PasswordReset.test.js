import { render, screen, fireEvent } from "@testing-library/react";
import Login from "./Login";
import SetPassword from "./SetPassword";
import { supabase } from "./supabase";

jest.mock("./supabase", () => ({
  supabase: { auth: { signInWithPassword: jest.fn(), resetPasswordForEmail: jest.fn(), updateUser: jest.fn() } },
}));

test("Forgot password sends a reset email that returns to /reset-password", async () => {
  supabase.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
  render(<Login />);
  fireEvent.click(screen.getByText("Forgot password?"));
  fireEvent.change(screen.getByPlaceholderText("your@email.com"), { target: { value: " victor@freedom-exteriors.com " } });
  fireEvent.click(screen.getByText("Send reset link"));
  await screen.findByText(/a reset link is on its way/);
  expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith("victor@freedom-exteriors.com", { redirectTo: `${window.location.origin}/reset-password` });
  fireEvent.click(screen.getByText("← Back to sign in"));
  expect(screen.getByText("Sign In")).toBeInTheDocument();
});

test("Unknown email gets the same confirmation (no account enumeration)", async () => {
  supabase.auth.resetPasswordForEmail.mockResolvedValue({ error: { message: "User not found" } });
  render(<Login />);
  fireEvent.click(screen.getByText("Forgot password?"));
  fireEvent.change(screen.getByPlaceholderText("your@email.com"), { target: { value: "nobody@example.com" } });
  fireEvent.click(screen.getByText("Send reset link"));
  await screen.findByText(/a reset link is on its way/);
});

test("Set new password validates, saves, then continues", async () => {
  supabase.auth.updateUser.mockResolvedValue({ error: null });
  const onDone = jest.fn();
  render(<SetPassword session={{ user: { email: "victor@freedom-exteriors.com" } }} onDone={onDone} />);
  expect(screen.getByText("for victor@freedom-exteriors.com")).toBeInTheDocument();
  const [pw, confirm] = screen.getAllByDisplayValue("");
  fireEvent.change(pw, { target: { value: "short" } });
  fireEvent.change(confirm, { target: { value: "short" } });
  fireEvent.click(screen.getByText("Save new password"));
  expect(screen.getByText("Use at least 8 characters.")).toBeInTheDocument();
  fireEvent.change(pw, { target: { value: "roofing-2026" } });
  fireEvent.change(confirm, { target: { value: "roofing-2027" } });
  fireEvent.click(screen.getByText("Save new password"));
  expect(screen.getByText("The two passwords don't match.")).toBeInTheDocument();
  expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  fireEvent.change(confirm, { target: { value: "roofing-2026" } });
  fireEvent.click(screen.getByText("Save new password"));
  await screen.findByText(/Password updated/);
  expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: "roofing-2026" });
  fireEvent.click(screen.getByText("Continue to the CRM"));
  expect(onDone).toHaveBeenCalled();
});

test("Expired link explains and offers a way back", () => {
  const onDone = jest.fn();
  render(<SetPassword session={null} linkError="Email link is invalid or has expired" onDone={onDone} />);
  expect(screen.getByText(/invalid or has expired/)).toBeInTheDocument();
  fireEvent.click(screen.getByText("Back to sign in"));
  expect(onDone).toHaveBeenCalled();
});
