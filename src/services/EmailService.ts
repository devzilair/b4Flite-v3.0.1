
import { EmailSettings } from '../types/settings';

export interface EmailPayload {
    event: string;
    to: string[];
    subject: string;
    body: string;
    metadata?: Record<string, any>;
}

class EmailService {
    /**
     * Sends a mock email notification by logging it to the console with rich formatting.
     */
    async sendMockEmail(payload: EmailPayload) {
        // Enforce mock behavior with a distinctive console style
        const style = 'background: #0D47A1; color: white; padding: 2px 5px; border-radius: 3px; font-weight: bold;';

        console.group(`%c📧 [MOCK EMAIL] ${payload.event}`, style);
        console.log(`To: ${payload.to.join(', ')}`);
        console.log(`Subject: ${payload.subject}`);
        console.log(`Timestamp: ${new Date().toLocaleString()}`);
        console.log('--- Body ---');
        console.log(payload.body);
        if (payload.metadata) {
            console.log('--- Metadata ---');
            console.dir(payload.metadata);
        }
        console.groupEnd();

        // In a real app, this would be an API call to a provider like SendGrid or AWS SES
        return { success: true, messageId: `mock_${Date.now()}` };
    }

    /**
     * Resolves recipients for an event based on department settings and overrides.
     */
    resolveRecipients(
        eventKey: keyof Omit<EmailSettings, 'recipientOverrides'>,
        settings: EmailSettings | undefined,
        defaultRecipients: string[] = ['System Administrators']
    ): string[] {
        if (!settings) return defaultRecipients;

        // Check for custom overrides first
        const overrides = settings.recipientOverrides?.[eventKey];
        if (overrides && overrides.length > 0) {
            return overrides;
        }

        return defaultRecipients;
    }

    /**
     * Formats standardized email content for different events.
     */
    formatContent(event: string, data: Record<string, any>): { subject: string; body: string } {
        const baseSubject = `[B4F] ${event}`;
        let body = '';

        switch (event) {
            case 'Exam Completed':
                body = `Staff member ${data.staffName} has successfully completed the exam "${data.examTitle}" with a score of ${data.score}%.`;
                break;
            case 'Exam Failed':
                body = `Staff member ${data.staffName} failed the required exam "${data.examTitle}" with a score of ${data.score}%. Immediate review may be required.`;
                break;
            case 'Leave Requested':
                body = `${data.staffName} has submitted a new leave request for ${data.dates}. Status: Pending review.`;
                break;
            case 'Leave Status Update':
                body = `Your leave request for ${data.dates} has been ${data.status}.`;
                break;
            case 'Roster Published':
                body = `The flight roster for ${data.month} has been published. You can view your duties in the portal.`;
                break;
            case 'Document Expiry Alert':
                body = `The document "${data.docName}" for ${data.staffName} is ${data.expiryStatus} (${data.expiryDate}).`;
                break;
            case 'New FSI/Notice Published':
                body = `A new notice "${data.title}" has been published and requires your acknowledgement.`;
                break;
            default:
                body = `A notification has been triggered for the event: ${event}.`;
        }

        return {
            subject: baseSubject,
            body: body.trim()
        };
    }
}

export const emailService = new EmailService();
