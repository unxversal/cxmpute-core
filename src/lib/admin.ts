import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand, ScanCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import { v4 as uuidv4 } from 'uuid';
import { 
  NotificationRecord, 
  AccountActionRecord, 
  AdminDashboardStats,
  UserRecord,
  ProviderRecord,
  ProvisionRecord
} from "./interfaces";
import { ADMIN_EMAILS } from "./privateutils";

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// ─────────────────────────────────────────────────────────────────────────────
// Admin Authorization
// ─────────────────────────────────────────────────────────────────────────────

export function isAdminUser(email: string): boolean {
  return ADMIN_EMAILS.includes(email);
}

export function requireAdmin(email: string): void {
  if (!isAdminUser(email)) {
    throw new Error("Unauthorized: Admin access required");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Notification Management
// ─────────────────────────────────────────────────────────────────────────────

export async function createNotification(
  location: "homepage" | "user_dashboard" | "provider_dashboard",
  title: string,
  content: string,
  startDate: string,
  endDate: string,
  createdBy: string
): Promise<NotificationRecord> {
  requireAdmin(createdBy);
  
  const notification: NotificationRecord = {
    notificationId: uuidv4(),
    location,
    title,
    content,
    startDate,
    endDate,
    isActive: true,
    createdBy,
    createdAt: new Date().toISOString()
  };
  
  await docClient.send(new PutCommand({
    TableName: Resource.NotificationsTable.name,
    Item: notification
  }));
  
  return notification;
}

export async function getActiveNotifications(
  location: "homepage" | "user_dashboard" | "provider_dashboard"
): Promise<NotificationRecord[]> {
  const now = new Date().toISOString();
  
  const response = await docClient.send(new QueryCommand({
    TableName: Resource.NotificationsTable.name,
    IndexName: "ByLocation",
    KeyConditionExpression: "#location = :location",
    FilterExpression: "isActive = :active AND startDate <= :now AND endDate >= :now",
    ExpressionAttributeNames: {
      "#location": "location"
    },
    ExpressionAttributeValues: {
      ":location": location,
      ":active": true,
      ":now": now
    }
  }));
  
  return response.Items as NotificationRecord[] || [];
}

export async function getAllNotifications(): Promise<NotificationRecord[]> {
  const response = await docClient.send(new ScanCommand({
    TableName: Resource.NotificationsTable.name
  }));
  
  return response.Items as NotificationRecord[] || [];
}

export async function deleteNotification(notificationId: string, deletedBy: string): Promise<void> {
  requireAdmin(deletedBy);
  
  await docClient.send(new DeleteCommand({
    TableName: Resource.NotificationsTable.name,
    Key: { notificationId }
  }));
}

export async function updateNotification(
  notificationId: string,
  updates: Partial<NotificationRecord>,
  updatedBy: string
): Promise<void> {
  requireAdmin(updatedBy);
  
  const updateExpression = [];
  const expressionAttributeValues: any = {};
  const expressionAttributeNames: any = {};
  
  Object.entries(updates).forEach(([key, value], index) => {
    if (key !== 'notificationId') {
      const valueKey = `:val${index}`;
      const nameKey = `#name${index}`;
      updateExpression.push(`${nameKey} = ${valueKey}`);
      expressionAttributeValues[valueKey] = value;
      expressionAttributeNames[nameKey] = key;
    }
  });
  
  if (updateExpression.length > 0) {
    await docClient.send(new UpdateCommand({
      TableName: Resource.NotificationsTable.name,
      Key: { notificationId },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames
    }));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Account Management
// ─────────────────────────────────────────────────────────────────────────────

export async function suspendAccount(
  userId: string,
  userType: "user" | "provider",
  reason: string,
  performedBy: string
): Promise<AccountActionRecord> {
  requireAdmin(performedBy);
  
  const action: AccountActionRecord = {
    actionId: uuidv4(),
    targetUserId: userId,
    userType,
    actionType: "suspend",
    reason,
    performedBy,
    timestamp: new Date().toISOString(),
    isActive: true
  };
  
  // Record the action
  await docClient.send(new PutCommand({
    TableName: Resource.AccountActionsTable.name,
    Item: action
  }));
  
  // Update the user/provider record
  const tableName = userType === "user" ? Resource.UserTable.name : Resource.ProviderTable.name;
  const keyField = userType === "user" ? "userId" : "providerId";
  
  await docClient.send(new UpdateCommand({
    TableName: tableName,
    Key: { [keyField]: userId },
    UpdateExpression: "SET suspended = :suspended, suspendedAt = :timestamp, suspendedBy = :admin, suspendedReason = :reason",
    ExpressionAttributeValues: {
      ":suspended": true,
      ":timestamp": new Date().toISOString(),
      ":admin": performedBy,
      ":reason": reason
    }
  }));
  
  return action;
}

export async function unsuspendAccount(
  userId: string,
  userType: "user" | "provider",
  reason: string,
  performedBy: string
): Promise<AccountActionRecord> {
  requireAdmin(performedBy);
  
  const action: AccountActionRecord = {
    actionId: uuidv4(),
    targetUserId: userId,
    userType,
    actionType: "unsuspend",
    reason,
    performedBy,
    timestamp: new Date().toISOString(),
    isActive: true
  };
  
  // Record the action
  await docClient.send(new PutCommand({
    TableName: Resource.AccountActionsTable.name,
    Item: action
  }));
  
  // Update the user/provider record
  const tableName = userType === "user" ? Resource.UserTable.name : Resource.ProviderTable.name;
  const keyField = userType === "user" ? "userId" : "providerId";
  
  await docClient.send(new UpdateCommand({
    TableName: tableName,
    Key: { [keyField]: userId },
    UpdateExpression: "REMOVE suspended, suspendedAt, suspendedBy, suspendedReason SET unsuspendedAt = :timestamp, unsuspendedBy = :admin",
    ExpressionAttributeValues: {
      ":timestamp": new Date().toISOString(),
      ":admin": performedBy
    }
  }));
  
  return action;
}

export async function deleteAccount(
  userId: string,
  userType: "user" | "provider",
  reason: string,
  performedBy: string
): Promise<AccountActionRecord> {
  requireAdmin(performedBy);
  
  const action: AccountActionRecord = {
    actionId: uuidv4(),
    targetUserId: userId,
    userType,
    actionType: "delete",
    reason,
    performedBy,
    timestamp: new Date().toISOString(),
    isActive: true
  };
  
  // Record the action first
  await docClient.send(new PutCommand({
    TableName: Resource.AccountActionsTable.name,
    Item: action
  }));
  
  // Delete from appropriate table
  const tableName = userType === "user" ? Resource.UserTable.name : Resource.ProviderTable.name;
  const keyField = userType === "user" ? "userId" : "providerId";
  
  await docClient.send(new DeleteCommand({
    TableName: tableName,
    Key: { [keyField]: userId }
  }));
  
  // If provider, also delete their provisions
  if (userType === "provider") {
    await disconnectProviderProvisions(userId, performedBy);
  }
  
  return action;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provision Management  
// ─────────────────────────────────────────────────────────────────────────────

export async function disconnectProviderProvisions(
  providerId: string,
  performedBy: string
): Promise<number> {
  requireAdmin(performedBy);
  
  // Get all provisions for this provider
  const response = await docClient.send(new QueryCommand({
    TableName: Resource.ProvisionsTable.name,
    IndexName: "ByProviderId",
    KeyConditionExpression: "providerId = :providerId",
    ExpressionAttributeValues: {
      ":providerId": providerId
    }
  }));
  
  const provisions = response.Items as ProvisionRecord[] || [];
  
  // Remove from all provision pool tables
  const poolTables = [
    Resource.LLMProvisionPoolTable.name,
    Resource.EmbeddingsProvisionPoolTable.name,
    Resource.ScrapingProvisionPoolTable.name,
    Resource.TTSProvisionPoolTable.name
  ];
  
  for (const provision of provisions) {
    // Delete from provisions table
    await docClient.send(new DeleteCommand({
      TableName: Resource.ProvisionsTable.name,
      Key: { provisionId: provision.provisionId }
    }));
    
    // Delete from pool tables
    for (const poolTable of poolTables) {
      try {
        await docClient.send(new DeleteCommand({
          TableName: poolTable,
          Key: { provisionId: provision.provisionId }
        }));
      } catch (error) {
        // Provision might not exist in this pool table, continue
      }
    }
  }
  
  return provisions.length;
}

export async function disconnectSpecificProvision(
  provisionId: string,
  performedBy: string
): Promise<void> {
  requireAdmin(performedBy);
  
  // Delete from provisions table
  await docClient.send(new DeleteCommand({
    TableName: Resource.ProvisionsTable.name,
    Key: { provisionId }
  }));
  
  // Delete from all pool tables
  const poolTables = [
    Resource.LLMProvisionPoolTable.name,
    Resource.EmbeddingsProvisionPoolTable.name,
    Resource.ScrapingProvisionPoolTable.name,
    Resource.TTSProvisionPoolTable.name
  ];
  
  for (const poolTable of poolTables) {
    try {
      await docClient.send(new DeleteCommand({
        TableName: poolTable,
        Key: { provisionId }
      }));
    } catch (error) {
      // Provision might not exist in this pool table, continue
    }
  }
}

export async function disconnectAllProvisions(performedBy: string): Promise<number> {
  requireAdmin(performedBy);
  
  // Get all provisions
  const response = await docClient.send(new ScanCommand({
    TableName: Resource.ProvisionsTable.name
  }));
  
  const provisions = response.Items as ProvisionRecord[] || [];
  
  // Delete all provisions
  for (const provision of provisions) {
    await disconnectSpecificProvision(provision.provisionId, performedBy);
  }
  
  return provisions.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Statistics
// ─────────────────────────────────────────────────────────────────────────────

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  // Get counts from various tables
  const [usersResponse, providersResponse, provisionsResponse, notificationsResponse, actionsResponse] = await Promise.all([
    docClient.send(new ScanCommand({
      TableName: Resource.UserTable.name,
      Select: "COUNT"
    })),
    docClient.send(new ScanCommand({
      TableName: Resource.ProviderTable.name,
      Select: "COUNT"
    })),
    docClient.send(new ScanCommand({
      TableName: Resource.ProvisionsTable.name,
      Select: "COUNT"
    })),
    docClient.send(new ScanCommand({
      TableName: Resource.NotificationsTable.name,
      FilterExpression: "isActive = :active",
      ExpressionAttributeValues: { ":active": true },
      Select: "COUNT"
    })),
    docClient.send(new ScanCommand({
      TableName: Resource.AccountActionsTable.name,
      FilterExpression: "actionType = :suspend AND isActive = :active",
      ExpressionAttributeValues: { ":suspend": "suspend", ":active": true },
      Select: "COUNT"
    }))
  ]);
  
  return {
    totalUsers: usersResponse.Count || 0,
    totalProviders: providersResponse.Count || 0,
    activeNotifications: notificationsResponse.Count || 0,
    suspendedAccounts: actionsResponse.Count || 0,
    totalProvisions: provisionsResponse.Count || 0,
    monthlyRevenue: 0, // TODO: Calculate from usage tracking
    systemHealth: "healthy" // TODO: Implement health checks
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// User/Provider Lookup
// ─────────────────────────────────────────────────────────────────────────────

export async function searchUsers(query: string): Promise<UserRecord[]> {
  // Simple scan with filter for email contains query
  const response = await docClient.send(new ScanCommand({
    TableName: Resource.UserTable.name,
    FilterExpression: "contains(email, :query)",
    ExpressionAttributeValues: {
      ":query": query
    }
  }));
  
  return response.Items as UserRecord[] || [];
}

export async function searchProviders(query: string): Promise<ProviderRecord[]> {
  // Simple scan with filter for email contains query
  const response = await docClient.send(new ScanCommand({
    TableName: Resource.ProviderTable.name,
    FilterExpression: "contains(providerEmail, :query)",
    ExpressionAttributeValues: {
      ":query": query
    }
  }));
  
  return response.Items as ProviderRecord[] || [];
}

export async function getUserById(userId: string): Promise<UserRecord | null> {
  const response = await docClient.send(new GetCommand({
    TableName: Resource.UserTable.name,
    Key: { userId }
  }));
  
  return response.Item as UserRecord || null;
}

export async function getProviderById(providerId: string): Promise<ProviderRecord | null> {
  const response = await docClient.send(new GetCommand({
    TableName: Resource.ProviderTable.name,
    Key: { providerId }
  }));
  
  return response.Item as ProviderRecord || null;
}

export async function getAccountActions(userId: string): Promise<AccountActionRecord[]> {
  const response = await docClient.send(new QueryCommand({
    TableName: Resource.AccountActionsTable.name,
    IndexName: "ByUser",
    KeyConditionExpression: "targetUserId = :userId",
    ExpressionAttributeValues: {
      ":userId": userId
    },
    ScanIndexForward: false // Most recent first
  }));
  
  return response.Items as AccountActionRecord[] || [];
} 