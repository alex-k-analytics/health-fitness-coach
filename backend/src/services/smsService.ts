export class SmsService {
  async sendReminder(phoneNumber: string, message: string) {
    return {
      phoneNumber,
      message,
      status: "stubbed",
      provider: "twilio-compatible"
    };
  }
}
