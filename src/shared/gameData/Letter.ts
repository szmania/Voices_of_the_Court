export enum ResponseStatus {
    Generating = "Generating",
    Pending = "Pending",
    Sent = "Sent",
    Failed = "Failed",
}

export enum SummaryStatus {
    Pending = "Pending",
    Generated = "Generated",
    Failed = "Failed",
}

export interface Letter {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  createdAt: Date;
  expectedDeliveryDay: number;
  currentDay: number;
  daysUntilDelivery: number;
  isLate: boolean;
  responseContent?: string;
  responseStatus: ResponseStatus;
  responseError?: string;
  summaryStatus: SummaryStatus;
  summaryContent?: string;
  summaryError?: string;
  characterName?: string;
  delivered?: boolean;
}
