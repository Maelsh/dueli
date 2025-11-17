# Dueli Platform - Complete API Documentation

## Base URL
```
Development: http://localhost:5000/api
Production: https://api.dueli.platform
```

## Authentication
Most endpoints require JWT authentication via HTTP-Only cookies.

**Headers:**
```
Cookie: token=<JWT_TOKEN>
Content-Type: application/json
```

---

# 1. Authentication Endpoints

## 1.1 Register User
**POST** `/auth/register`

**Description:** Create a new user account

**Authentication:** None required

**Request Body:**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "language": "en",
  "country": "US"
}
```

**Validation Rules:**
- `username`: 3-30 chars, alphanumeric + underscore
- `email`: Valid email format
- `password`: Min 8 chars, 1 uppercase, 1 lowercase, 1 number
- `language`: Optional, enum ['ar', 'en', 'fr', 'es', 'de', 'tr', 'ur']
- `country`: Optional, 2-letter country code

**Success Response (201):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "64a1b2c3d4e5f6g7h8i9j0k1",
      "username": "john_doe",
      "email": "john@example.com",
      "role": "user",
      "language": "en",
      "country": "US",
      "createdAt": "2024-11-16T10:30:00.000Z"
    },
    "token": "<JWT_TOKEN>"
  }
}
```

**Error Responses:**
- `400`: Validation error
- `409`: Username or email already exists

---

## 1.2 Login User
**POST** `/auth/login`

**Description:** Authenticate user and receive JWT token

**Authentication:** None required

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "64a1b2c3d4e5f6g7h8i9j0k1",
      "username": "john_doe",
      "email": "john@example.com",
      "role": "user",
      "avatar": "/avatars/john_doe.jpg",
      "youtubeLinked": true
    },
    "token": "<JWT_TOKEN>"
  }
}
```

**Error Responses:**
- `400`: Missing credentials
- `401`: Invalid email or password
- `403`: Account suspended

---

## 1.3 Logout User
**POST** `/auth/logout`

**Description:** Clear JWT token cookie

**Authentication:** Required

**Success Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 1.4 Get Current User
**GET** `/auth/me`

**Description:** Get authenticated user's full profile

**Authentication:** Required

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "64a1b2c3d4e5f6g7h8i9j0k1",
      "username": "john_doe",
      "email": "john@example.com",
      "role": "user",
      "bio": "Passionate debater",
      "avatar": "/avatars/john_doe.jpg",
      "language": "en",
      "country": "US",
      "youtubeLinked": true,
      "youtubeChannelName": "John's Channel",
      "followerCount": 150,
      "reportCount": 0,
      "overallRating": 4.5,
      "totalEarnings": 500.00,
      "totalChallenges": 25,
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

---

## 1.5 Update Profile
**PUT** `/auth/update-profile`

**Description:** Update user profile information

**Authentication:** Required

**Request Body:**
```json
{
  "bio": "Updated bio",
  "avatar": "https://cdn.dueli.com/avatars/new-avatar.jpg",
  "preferredCategories": ["dialogue", "science"],
  "language": "ar",
  "country": "EG"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "user": { /* updated user object */ }
  }
}
```

---

## 1.6 Initiate YouTube OAuth
**POST** `/auth/youtube/connect`

**Description:** Generate YouTube OAuth URL for linking account

**Authentication:** Required

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...",
    "state": "random_state_token"
  }
}
```

---

## 1.7 YouTube OAuth Callback
**GET** `/auth/youtube/callback?code=<CODE>&state=<STATE>`

**Description:** Handle OAuth callback and store tokens

**Authentication:** Required (via state token)

**Success Response (302):**
- Redirects to frontend with success message

**Error Response (302):**
- Redirects to frontend with error message

---

# 2. User Endpoints

## 2.1 Get User Profile (Public)
**GET** `/users/:id`

**Description:** Get public profile of any user

**Authentication:** Optional (more details if authenticated)

**Path Parameters:**
- `id`: User ObjectId or username

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "64a1b2c3d4e5f6g7h8i9j0k1",
      "username": "john_doe",
      "bio": "Passionate debater",
      "avatar": "/avatars/john_doe.jpg",
      "followerCount": 150,
      "reportCount": 0,
      "overallRating": 4.5,
      "totalChallenges": 25,
      "preferredCategories": ["dialogue", "science"],
      "createdAt": "2024-01-15T10:30:00.000Z",
      "isFollowing": false
    }
  }
}
```

---

## 2.2 Get User's Challenges
**GET** `/users/:id/challenges`

**Description:** Get list of user's challenges

**Authentication:** Optional

**Query Parameters:**
- `status`: Filter by status (pending, live, completed)
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 50)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "challenges": [
      {
        "id": "64b1c2d3e4f5g6h7i8j9k0l1",
        "title": "Climate Change Debate",
        "category": "dialogue",
        "status": "completed",
        "creator": { "id": "...", "username": "john_doe" },
        "opponent": { "id": "...", "username": "jane_smith" },
        "scheduledTime": "2024-11-10T15:00:00.000Z",
        "viewerCount": 250,
        "totalRevenue": 100.00
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "pages": 3
    }
  }
}
```

---

## 2.3 Follow User
**POST** `/users/:id/follow`

**Description:** Follow a user

**Authentication:** Required

**Success Response (200):**
```json
{
  "success": true,
  "message": "User followed successfully",
  "data": {
    "following": true,
    "followerCount": 151
  }
}
```

**Error Responses:**
- `400`: Cannot follow yourself
- `404`: User not found
- `409`: Already following

---

## 2.4 Unfollow User
**DELETE** `/users/:id/follow`

**Description:** Unfollow a user

**Authentication:** Required

**Success Response (200):**
```json
{
  "success": true,
  "message": "User unfollowed successfully",
  "data": {
    "following": false,
    "followerCount": 149
  }
}
```

---

## 2.5 Block User
**POST** `/users/:id/block`

**Description:** Block a user from messaging

**Authentication:** Required

**Success Response (200):**
```json
{
  "success": true,
  "message": "User blocked successfully"
}
```

---

## 2.6 Unblock User
**DELETE** `/users/:id/block`

**Description:** Unblock a user

**Authentication:** Required

**Success Response (200):**
```json
{
  "success": true,
  "message": "User unblocked successfully"
}
```

---

## 2.7 Get User Earnings
**GET** `/users/:id/earnings`

**Description:** Get user's earnings history (own only)

**Authentication:** Required (must be own profile)

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "totalEarnings": 500.00,
    "transactions": [
      {
        "id": "64c1d2e3f4g5h6i7j8k9l0m1",
        "challenge": {
          "id": "...",
          "title": "Climate Change Debate"
        },
        "amount": 50.00,
        "currency": "USD",
        "status": "completed",
        "invoiceNumber": "INV-1700123456-789",
        "paymentDate": "2024-11-12T10:00:00.000Z",
        "metadata": {
          "ratingPercentage": 65,
          "totalChallengeRevenue": 100.00
        }
      }
    ],
    "pagination": { /* ... */ }
  }
}
```

---

## 2.8 Update Bank Details
**PUT** `/users/bank-details`

**Description:** Update encrypted bank details

**Authentication:** Required

**Request Body:**
```json
{
  "accountNumber": "1234567890",
  "bankName": "Example Bank",
  "accountHolder": "John Doe",
  "iban": "EG123456789012345678901234"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Bank details updated successfully (encrypted)"
}
```

**Note:** Account number is encrypted with AES-256-GCM before storage

---

# 3. Challenge Endpoints

## 3.1 List Challenges
**GET** `/challenges`

**Description:** Get paginated list of challenges with filters

**Authentication:** Optional

**Query Parameters:**
- `status`: Filter by status (pending, scheduled, live, completed)
- `category`: Filter by category (dialogue, science, talent)
- `field`: Filter by field/sub-category
- `language`: Filter by language
- `country`: Filter by country
- `search`: Search in title/description
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 50)
- `sort`: Sort by (createdAt, scheduledTime, viewerCount, totalRevenue)
- `order`: Sort order (asc, desc, default: desc)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "challenges": [
      {
        "id": "64b1c2d3e4f5g6h7i8j9k0l1",
        "title": "Climate Change: Fact or Fiction?",
        "description": "A debate on climate science",
        "category": "dialogue",
        "field": "Political Ideologies",
        "status": "scheduled",
        "creator": {
          "id": "...",
          "username": "john_doe",
          "avatar": "/avatars/john_doe.jpg",
          "overallRating": 4.5
        },
        "opponent": {
          "id": "...",
          "username": "jane_smith",
          "avatar": "/avatars/jane_smith.jpg",
          "overallRating": 4.7
        },
        "rules": {
          "duration": 60,
          "rounds": 3,
          "roundDuration": 15,
          "customRules": "No personal attacks allowed"
        },
        "scheduledTime": "2024-11-20T18:00:00.000Z",
        "language": "en",
        "country": "US",
        "viewerCount": 0,
        "totalComments": 0,
        "createdAt": "2024-11-15T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "pages": 8
    }
  }
}
```

---

## 3.2 Get Challenge Details
**GET** `/challenges/:id`

**Description:** Get full details of a specific challenge

**Authentication:** Optional

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "challenge": {
      "id": "64b1c2d3e4f5g6h7i8j9k0l1",
      "title": "Climate Change: Fact or Fiction?",
      "description": "A comprehensive debate...",
      "category": "dialogue",
      "field": "Political Ideologies",
      "status": "live",
      "creator": { /* full user object */ },
      "opponent": { /* full user object */ },
      "rules": { /* full rules */ },
      "scheduledTime": "2024-11-20T18:00:00.000Z",
      "startedAt": "2024-11-20T18:02:00.000Z",
      "creatorYoutubeUrl": "https://youtube.com/embed/...",
      "opponentYoutubeUrl": "https://youtube.com/embed/...",
      "advertisements": [
        {
          "adId": "...",
          "displayTime": "2024-11-20T18:15:00.000Z",
          "status": "pending"
        }
      ],
      "viewerCount": 250,
      "peakViewers": 350,
      "totalComments": 89,
      "totalRatings": 120,
      "creatorAvgRating": 4.2,
      "opponentAvgRating": 4.8,
      "totalRevenue": 150.00,
      "revenueDistribution": {
        "platform": 30.00,
        "creator": 48.00,
        "opponent": 72.00
      },
      "language": "en",
      "country": "US"
    }
  }
}
```

---

## 3.3 Create Challenge
**POST** `/challenges`

**Description:** Create a new challenge

**Authentication:** Required

**Request Body:**
```json
{
  "title": "Quantum Physics Explained",
  "description": "A scientific discussion on quantum mechanics",
  "category": "science",
  "field": "Physics",
  "rules": {
    "duration": 90,
    "rounds": 2,
    "roundDuration": 30,
    "customRules": "Must cite sources for all claims"
  },
  "scheduledTime": "2024-11-25T16:00:00.000Z",
  "language": "en",
  "country": "US"
}
```

**Validation:**
- `title`: Required, 5-200 chars
- `category`: Required, enum
- `field`: Required, max 100 chars
- `rules.duration`: 5-300 minutes
- `scheduledTime`: Must be in future

**Success Response (201):**
```json
{
  "success": true,
  "message": "Challenge created successfully",
  "data": {
    "challenge": { /* full challenge object */ }
  }
}
```

---

## 3.4 Update Challenge
**PUT** `/challenges/:id`

**Description:** Update challenge details (creator only, before it starts)

**Authentication:** Required (must be creator)

**Request Body:** (All fields optional)
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "rules": { /* updated rules */ },
  "scheduledTime": "2024-11-26T16:00:00.000Z"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Challenge updated successfully",
  "data": {
    "challenge": { /* updated challenge */ }
  }
}
```

**Error Responses:**
- `403`: Not challenge creator
- `400`: Challenge already started
- `404`: Challenge not found

---

## 3.5 Cancel Challenge
**DELETE** `/challenges/:id`

**Description:** Cancel a pending/scheduled challenge

**Authentication:** Required (must be creator or admin)

**Request Body:**
```json
{
  "reason": "Unable to attend"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Challenge cancelled successfully"
}
```

---

## 3.6 Request to Join Challenge
**POST** `/challenges/:id/join`

**Description:** Request to join a pending challenge as opponent

**Authentication:** Required

**Request Body:**
```json
{
  "message": "I would love to participate in this debate!"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Join request sent successfully",
  "data": {
    "invitation": {
      "id": "64d1e2f3g4h5i6j7k8l9m0n1",
      "challenge": "64b1c2d3e4f5g6h7i8j9k0l1",
      "status": "pending",
      "expiresAt": "2024-11-18T10:00:00.000Z"
    }
  }
}
```

---

## 3.7 Accept/Reject Join Request
**PUT** `/challenges/:id/accept/:userId`

**Description:** Accept or reject a join request

**Authentication:** Required (must be creator)

**Request Body:**
```json
{
  "action": "accept",
  "message": "Looking forward to our debate!"
}
```

**Actions:** `accept` or `reject`

**Success Response (200):**
```json
{
  "success": true,
  "message": "Opponent accepted successfully",
  "data": {
    "challenge": { /* updated challenge with opponent */ }
  }
}
```

---

## 3.8 Start Live Challenge
**POST** `/challenges/:id/start`

**Description:** Start the live challenge and initiate YouTube streams

**Authentication:** Required (must be participant)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Challenge started successfully",
  "data": {
    "challenge": {
      "id": "64b1c2d3e4f5g6h7i8j9k0l1",
      "status": "live",
      "startedAt": "2024-11-20T18:02:15.000Z",
      "creatorYoutubeUrl": "https://youtube.com/embed/...",
      "opponentYoutubeUrl": "https://youtube.com/embed/...",
      "creatorStreamKey": "xxxx-xxxx-xxxx-xxxx"
    }
  }
}
```

**Error Responses:**
- `400`: Challenge not ready (missing opponent, too early, etc.)
- `403`: Not a participant
- `500`: YouTube API error

---

## 3.9 End Challenge
**POST** `/challenges/:id/end`

**Description:** End live challenge and calculate revenue

**Authentication:** Required (must be participant)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Challenge ended successfully",
  "data": {
    "challenge": {
      "status": "completed",
      "endedAt": "2024-11-20T19:32:45.000Z",
      "totalRevenue": 150.00,
      "revenueDistribution": {
        "platform": 30.00,
        "creator": 48.00,
        "opponent": 72.00
      },
      "creatorAvgRating": 4.2,
      "opponentAvgRating": 4.8
    },
    "transactions": [
      { /* creator transaction */ },
      { /* opponent transaction */ }
    ]
  }
}
```

---

## 3.10 Reject Advertisement
**POST** `/challenges/:id/reject-ad/:adId`

**Description:** Competitor rejects a displayed advertisement

**Authentication:** Required (must be participant)

**Request Body:**
```json
{
  "reason": "Conflicts with my principles"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Advertisement rejected successfully",
  "data": {
    "advertisement": {
      "id": "64e1f2g3h4i5j6k7l8m9n0o1",
      "status": "rejected",
      "rejectedBy": "64a1b2c3d4e5f6g7h8i9j0k1",
      "rejectionReason": "Conflicts with my principles",
      "rejectionDate": "2024-11-20T18:25:30.000Z"
    }
  }
}
```

**Note:** Revenue calculation will exclude this ad

---

## 3.11 Get Challenge Ratings
**GET** `/challenges/:id/ratings`

**Description:** Get aggregated ratings for a challenge

**Authentication:** Optional

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "ratings": {
      "creator": {
        "userId": "64a1b2c3d4e5f6g7h8i9j0k1",
        "username": "john_doe",
        "totalScore": 504,
        "count": 120,
        "average": 4.2,
        "percentage": 40
      },
      "opponent": {
        "userId": "64a1b2c3d4e5f6g7h8i9j0k1",
        "username": "jane_smith",
        "totalScore": 576,
        "count": 120,
        "average": 4.8,
        "percentage": 60
      },
      "totalRatings": 240
    }
  }
}
```

---

## 3.12 Get Challenge Comments
**GET** `/challenges/:id/comments`

**Description:** Get paginated comments for a challenge

**Authentication:** Optional

**Query Parameters:**
- `page`: Page number
- `limit`: Items per page (default: 50, max: 100)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "comments": [
      {
        "id": "64f1g2h3i4j5k6l7m8n9o0p1",
        "author": {
          "id": "...",
          "username": "viewer_123",
          "avatar": "/avatars/viewer_123.jpg"
        },
        "content": "Great debate! Very informative.",
        "timestamp": "2024-11-20T18:15:30.000Z"
      }
    ],
    "pagination": { /* ... */ }
  }
}
```

---

# 4. Rating Endpoints

## 4.1 Submit Rating
**POST** `/ratings`

**Description:** Submit a rating during live challenge

**Authentication:** Required (registered viewers only)

**Request Body:**
```json
{
  "challenge": "64b1c2d3e4f5g6h7i8j9k0l1",
  "competitorRated": "64a1b2c3d4e5f6g7h8i9j0k1",
  "score": 5
}
```

**Validation:**
- `challenge`: Must be live
- `competitorRated`: Must be participant
- `score`: 1-5
- One rating per user per competitor per challenge

**Success Response (201):**
```json
{
  "success": true,
  "message": "Rating submitted successfully",
  "data": {
    "rating": {
      "id": "64g1h2i3j4k5l6m7n8o9p0q1",
      "challenge": "64b1c2d3e4f5g6h7i8j9k0l1",
      "competitorRated": "64a1b2c3d4e5f6g7h8i9j0k1",
      "score": 5,
      "timestamp": "2024-11-20T18:20:45.000Z"
    },
    "aggregated": {
      "average": 4.3,
      "count": 85
    }
  }
}
```

**Note:** WebSocket event `ratings_update` is emitted to all viewers

---

## 4.2 Get Challenge Ratings (Aggregated)
**GET** `/ratings/challenge/:id`

**Description:** Get aggregated ratings (same as 3.11)

---

# 5. Comment Endpoints

## 5.1 Post Comment
**POST** `/comments`

**Description:** Post a comment on a live or completed challenge

**Authentication:** Required (registered users only)

**Request Body:**
```json
{
  "challenge": "64b1c2d3e4f5g6h7i8j9k0l1",
  "content": "This is a fantastic discussion!"
}
```

**Validation:**
- `content`: 1-500 chars, required

**Success Response (201):**
```json
{
  "success": true,
  "message": "Comment posted successfully",
  "data": {
    "comment": {
      "id": "64h1i2j3k4l5m6n7o8p9q0r1",
      "challenge": "64b1c2d3e4f5g6h7i8j9k0l1",
      "author": {
        "id": "64a1b2c3d4e5f6g7h8i9j0k1",
        "username": "john_doe",
        "avatar": "/avatars/john_doe.jpg"
      },
      "content": "This is a fantastic discussion!",
      "timestamp": "2024-11-20T18:25:10.000Z"
    }
  }
}
```

**Note:** WebSocket event `comment_added` is emitted

---

## 5.2 Get Challenge Comments
**GET** `/comments/challenge/:id`

**Description:** Same as 3.12

---

## 5.3 Delete Comment
**DELETE** `/comments/:id`

**Description:** Delete own comment (soft delete)

**Authentication:** Required (must be author or admin)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Comment deleted successfully"
}
```

---

# 6. Message Endpoints

## 6.1 Get Inbox
**GET** `/messages`

**Description:** Get received messages (inbox)

**Authentication:** Required

**Query Parameters:**
- `page`: Page number
- `limit`: Items per page (default: 20)
- `unread`: Filter unread only (true/false)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "64i1j2k3l4m5n6o7p8q9r0s1",
        "sender": {
          "id": "...",
          "username": "jane_smith",
          "avatar": "/avatars/jane_smith.jpg"
        },
        "subject": "Challenge Invitation",
        "content": "Hey! Would you like to debate climate change?",
        "read": false,
        "createdAt": "2024-11-18T14:30:00.000Z"
      }
    ],
    "pagination": { /* ... */ },
    "unreadCount": 5
  }
}
```

---

## 6.2 Get Sent Messages
**GET** `/messages/sent`

**Description:** Get sent messages

**Authentication:** Required

**Query Parameters:** Same as 6.1

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "messages": [ /* ... */ ],
    "pagination": { /* ... */ }
  }
}
```

---

## 6.3 Send Message
**POST** `/messages`

**Description:** Send a message to another user

**Authentication:** Required

**Request Body:**
```json
{
  "receiver": "64a1b2c3d4e5f6g7h8i9j0k1",
  "subject": "Challenge Proposal",
  "content": "Hi! I noticed you're interested in science debates. Would you like to compete?"
}
```

**Validation:**
- `receiver`: Must not be blocked or have blocked you
- `subject`: Max 200 chars
- `content`: 1-2000 chars

**Success Response (201):**
```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "message": { /* message object */ }
  }
}
```

**Error Responses:**
- `403`: User has blocked you
- `404`: Receiver not found

---

## 6.4 Mark Message as Read
**PUT** `/messages/:id/read`

**Description:** Mark a received message as read

**Authentication:** Required (must be receiver)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Message marked as read"
}
```

---

## 6.5 Delete Message
**DELETE** `/messages/:id`

**Description:** Delete message (soft delete, only removes from your view)

**Authentication:** Required

**Success Response (200):**
```json
{
  "success": true,
  "message": "Message deleted successfully"
}
```

---

# 7. Report Endpoints

## 7.1 Submit Report
**POST** `/reports`

**Description:** Report a user, challenge, or comment

**Authentication:** Required

**Request Body:**
```json
{
  "reportedUser": "64a1b2c3d4e5f6g7h8i9j0k1",
  "reportedChallenge": "64b1c2d3e4f5g6h7i8j9k0l1",
  "reason": "offensive",
  "description": "User made personal attacks during debate",
  "evidence": "https://youtube.com/timestamp=..."
}
```

**Validation:**
- `reportedUser`: Required
- `reportedChallenge` OR `reportedComment`: Optional
- `reason`: Required enum ['offensive', 'fraud', 'misconduct', 'misleading', 'rules_violation', 'spam', 'harassment', 'other']
- `description`: Required, 10-1000 chars
- `evidence`: Optional, max 500 chars

**Success Response (201):**
```json
{
  "success": true,
  "message": "Report submitted successfully",
  "data": {
    "report": {
      "id": "64j1k2l3m4n5o6p7q8r9s0t1",
      "reporter": "64a1b2c3d4e5f6g7h8i9j0k1",
      "reportedUser": "64a1b2c3d4e5f6g7h8i9j0k1",
      "reason": "offensive",
      "status": "pending",
      "createdAt": "2024-11-20T10:15:00.000Z"
    }
  }
}
```

---

## 7.2 Get My Reports
**GET** `/reports/my-reports`

**Description:** Get reports submitted by current user

**Authentication:** Required

**Query Parameters:**
- `status`: Filter by status (pending, reviewing, resolved, dismissed)
- `page`: Page number
- `limit`: Items per page (default: 10)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "reports": [
      {
        "id": "64j1k2l3m4n5o6p7q8r9s0t1",
        "reportedUser": {
          "id": "...",
          "username": "bad_user"
        },
        "reason": "offensive",
        "description": "User made personal attacks",
        "status": "reviewing",
        "createdAt": "2024-11-20T10:15:00.000Z",
        "reviewedBy": {
          "id": "...",
          "username": "admin_01"
        },
        "adminAction": "warn",
        "actionReason": "First offense, issued warning"
      }
    ],
    "pagination": { /* ... */ }
  }
}
```

---

# 8. Admin Endpoints

## 8.1 Get All Reports
**GET** `/admin/reports`

**Description:** Get all reports for moderation (admin only)

**Authentication:** Required (admin role)

**Query Parameters:**
- `status`: Filter by status
- `reason`: Filter by reason
- `reportedUser`: Filter by reported user ID
- `page`: Page number
- `limit`: Items per page (default: 20)
- `sort`: Sort by (createdAt, status)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "reports": [
      {
        "id": "64j1k2l3m4n5o6p7q8r9s0t1",
        "reporter": {
          "id": "...",
          "username": "user_123",
          "avatar": "/avatars/user_123.jpg"
        },
        "reportedUser": {
          "id": "...",
          "username": "bad_user",
          "avatar": "/avatars/bad_user.jpg",
          "reportCount": 3
        },
        "reportedChallenge": {
          "id": "...",
          "title": "Controversial Debate"
        },
        "reason": "offensive",
        "description": "User made personal attacks during debate",
        "evidence": "https://youtube.com/timestamp=12:34",
        "status": "pending",
        "createdAt": "2024-11-20T10:15:00.000Z"
      }
    ],
    "pagination": { /* ... */ },
    "stats": {
      "pending": 15,
      "reviewing": 5,
      "resolved": 100,
      "dismissed": 20
    }
  }
}
```

---

## 8.2 Take Action on Report
**PUT** `/admin/reports/:id/action`

**Description:** Take moderation action on a report (admin only)

**Authentication:** Required (admin role)

**Request Body:**
```json
{
  "action": "warn",
  "actionReason": "First offense. User has been warned about personal attacks. Further violations will result in suspension."
}
```

**Actions:** `warn`, `suspend`, `ban`, `delete_content`, `cancel_challenge`, `none`

**Validation:**
- `action`: Required enum
- `actionReason`: **MANDATORY** for transparency, 20-1000 chars

**Success Response (200):**
```json
{
  "success": true,
  "message": "Action taken successfully",
  "data": {
    "report": {
      "id": "64j1k2l3m4n5o6p7q8r9s0t1",
      "status": "resolved",
      "reviewedBy": "64a1b2c3d4e5f6g7h8i9j0k1",
      "adminAction": "warn",
      "actionReason": "First offense. User has been warned...",
      "actionDate": "2024-11-20T15:30:00.000Z"
    },
    "affectedUser": {
      "id": "...",
      "username": "bad_user",
      "isSuspended": false,
      "reportCount": 3
    }
  }
}
```

**Error Responses:**
- `400`: Missing or invalid actionReason
- `403`: Not admin
- `404`: Report not found

**Note:** Action reason is stored and publicly viewable for transparency

---

## 8.3 Get All Users (Admin)
**GET** `/admin/users`

**Description:** Get list of all users with stats (admin only)

**Authentication:** Required (admin role)

**Query Parameters:**
- `search`: Search by username or email
- `role`: Filter by role (user, admin)
- `isSuspended`: Filter suspended users (true/false)
- `reportCount`: Filter users with reports >= value
- `page`: Page number
- `limit`: Items per page (default: 50)
- `sort`: Sort by (createdAt, reportCount, totalEarnings, followerCount)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "64a1b2c3d4e5f6g7h8i9j0k1",
        "username": "john_doe",
        "email": "john@example.com",
        "role": "user",
        "followerCount": 150,
        "reportCount": 0,
        "totalEarnings": 500.00,
        "totalChallenges": 25,
        "isSuspended": false,
        "lastLogin": "2024-11-20T12:00:00.000Z",
        "createdAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": { /* ... */ },
    "stats": {
      "totalUsers": 10000,
      "activeUsers": 9500,
      "suspendedUsers": 50
    }
  }
}
```

---

## 8.4 Suspend User
**PUT** `/admin/users/:id/suspend`

**Description:** Suspend a user account (admin only)

**Authentication:** Required (admin role)

**Request Body:**
```json
{
  "duration": 7,
  "reason": "Repeated violations of community guidelines. User made personal attacks in 3 separate challenges despite warnings."
}
```

**Validation:**
- `duration`: Days to suspend (1-365) or 0 for permanent
- `reason`: **MANDATORY**, 20-1000 chars

**Success Response (200):**
```json
{
  "success": true,
  "message": "User suspended successfully",
  "data": {
    "user": {
      "id": "64a1b2c3d4e5f6g7h8i9j0k1",
      "username": "john_doe",
      "isSuspended": true,
      "suspendedUntil": "2024-11-27T15:30:00.000Z",
      "suspensionReason": "Repeated violations..."
    }
  }
}
```

---

## 8.5 Unsuspend User
**PUT** `/admin/users/:id/unsuspend`

**Description:** Remove suspension from user (admin only)

**Authentication:** Required (admin role)

**Success Response (200):**
```json
{
  "success": true,
  "message": "User unsuspended successfully"
}
```

---

## 8.6 List Advertisements
**GET** `/admin/ads`

**Description:** Get all advertisements (admin only)

**Authentication:** Required (admin role)

**Query Parameters:**
- `status`: Filter by status (pending, assigned, displayed, rejected, expired)
- `assignedChallenge`: Filter by challenge ID
- `page`: Page number
- `limit`: Items per page

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "advertisements": [
      {
        "id": "64k1l2m3n4o5p6q7r8s9t0u1",
        "advertiser": "Tech Corp",
        "content": {
          "type": "video",
          "url": "https://cdn.dueli.com/ads/tech-corp-ad.mp4"
        },
        "paidAmount": 100.00,
        "calculatedDuration": 30,
        "assignedChallenge": {
          "id": "...",
          "title": "AI Ethics Debate"
        },
        "status": "assigned",
        "createdAt": "2024-11-18T10:00:00.000Z"
      }
    ],
    "pagination": { /* ... */ },
    "stats": {
      "totalRevenue": 10000.00,
      "pending": 5,
      "assigned": 10,
      "displayed": 50
    }
  }
}
```

---

## 8.7 Create Advertisement
**POST** `/admin/ads`

**Description:** Create a new advertisement (admin only)

**Authentication:** Required (admin role)

**Request Body:**
```json
{
  "advertiser": "Tech Corp Inc.",
  "advertiserContact": {
    "email": "ads@techcorp.com",
    "phone": "+1234567890"
  },
  "content": {
    "type": "video",
    "url": "https://cdn.dueli.com/ads/video.mp4",
    "thumbnailUrl": "https://cdn.dueli.com/ads/thumb.jpg"
  },
  "paidAmount": 150.00
}
```

**Validation:**
- `advertiser`: Required, max 200 chars
- `content.type`: Required enum ['video', 'image', 'text']
- `content.url`: Required for video/image
- `paidAmount`: Required, min 1.00

**Duration Calculation Formula:**
```
calculatedDuration = (paidAmount / 5) * 60 seconds
Example: $100 = 20 minutes = 1200 seconds
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Advertisement created successfully",
  "data": {
    "advertisement": {
      "id": "64k1l2m3n4o5p6q7r8s9t0u1",
      "advertiser": "Tech Corp Inc.",
      "paidAmount": 150.00,
      "calculatedDuration": 1800,
      "status": "pending",
      "createdAt": "2024-11-20T16:00:00.000Z"
    }
  }
}
```

---

## 8.8 Assign Advertisement to Challenge
**PUT** `/admin/ads/:id/assign`

**Description:** Assign an advertisement to a specific challenge (admin only)

**Authentication:** Required (admin role)

**Request Body:**
```json
{
  "challengeId": "64b1c2d3e4f5g6h7i8j9k0l1",
  "displayTime": "2024-11-25T18:15:00.000Z"
}
```

**Validation:**
- `challengeId`: Must be scheduled or live challenge
- `displayTime`: Must be during challenge time

**Success Response (200):**
```json
{
  "success": true,
  "message": "Advertisement assigned successfully",
  "data": {
    "advertisement": {
      "id": "64k1l2m3n4o5p6q7r8s9t0u1",
      "status": "assigned",
      "assignedChallenge": "64b1c2d3e4f5g6h7i8j9k0l1",
      "displayTime": "2024-11-25T18:15:00.000Z"
    }
  }
}
```

---

## 8.9 Platform Analytics
**GET** `/admin/analytics`

**Description:** Get comprehensive platform analytics (admin only)

**Authentication:** Required (admin role)

**Query Parameters:**
- `timeframe`: Filter by timeframe (7d, 30d, 90d, 1y, all)
- `metrics`: Specific metrics (comma-separated)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "users": {
      "total": 10000,
      "new": 150,
      "active": 7500,
      "suspended": 50
    },
    "challenges": {
      "total": 5000,
      "completed": 4500,
      "live": 10,
      "scheduled": 100,
      "cancelled": 50
    },
    "revenue": {
      "totalGenerated": 50000.00,
      "platformShare": 10000.00,
      "competitorsShare": 40000.00,
      "averagePerChallenge": 10.00
    },
    "advertisements": {
      "total": 200,
      "displayed": 150,
      "rejected": 10,
      "totalRevenue": 15000.00
    },
    "engagement": {
      "totalRatings": 50000,
      "totalComments": 25000,
      "averageViewersPerChallenge": 150
    },
    "reports": {
      "total": 150,
      "resolved": 100,
      "pending": 30
    }
  }
}
```

---

# 9. Notification Endpoints

## 9.1 Get Notifications
**GET** `/notifications`

**Description:** Get user's notifications

**Authentication:** Required

**Query Parameters:**
- `unread`: Filter unread only (true/false)
- `type`: Filter by type
- `page`: Page number
- `limit`: Items per page (default: 20)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "64l1m2n3o4p5q6r7s8t9u0v1",
        "type": "challenge_invite",
        "content": "john_doe invited you to a challenge: 'Climate Change Debate'",
        "link": "/challenges/64b1c2d3e4f5g6h7i8j9k0l1",
        "read": false,
        "priority": "high",
        "metadata": {
          "challengeId": "64b1c2d3e4f5g6h7i8j9k0l1",
          "userId": "64a1b2c3d4e5f6g7h8i9j0k1"
        },
        "createdAt": "2024-11-20T14:30:00.000Z"
      }
    ],
    "pagination": { /* ... */ },
    "unreadCount": 5
  }
}
```

---

## 9.2 Mark Notification as Read
**PUT** `/notifications/:id/read`

**Description:** Mark a notification as read

**Authentication:** Required

**Success Response (200):**
```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

---

## 9.3 Mark All as Read
**PUT** `/notifications/read-all`

**Description:** Mark all notifications as read

**Authentication:** Required

**Success Response (200):**
```json
{
  "success": true,
  "message": "All notifications marked as read"
}
```

---

## 9.4 Delete Notification
**DELETE** `/notifications/:id`

**Description:** Delete a notification

**Authentication:** Required

**Success Response (200):**
```json
{
  "success": true,
  "message": "Notification deleted successfully"
}
```

---

# 10. WebSocket Events (Socket.IO)

## Connection
```javascript
const socket = io('https://api.dueli.platform', {
  auth: {
    token: 'JWT_TOKEN'
  }
});
```

## 10.1 Join Challenge Room
**Client → Server**
```javascript
socket.emit('join_challenge', {
  challengeId: '64b1c2d3e4f5g6h7i8j9k0l1'
});
```

**Server → Client**
```javascript
socket.on('viewer_joined', (data) => {
  console.log('Current viewers:', data.viewerCount);
});
```

---

## 10.2 Real-time Ratings
**Client → Server** (when user submits rating via API)
```javascript
// Handled by API, then WebSocket broadcasts
```

**Server → All Clients in Room**
```javascript
socket.on('ratings_update', (data) => {
  /*
  data = {
    challengeId: '...',
    creator: {
      totalScore: 504,
      count: 120,
      average: 4.2,
      percentage: 40
    },
    opponent: {
      totalScore: 576,
      count: 120,
      average: 4.8,
      percentage: 60
    }
  }
  */
  updateRatingsUI(data);
});
```

---

## 10.3 Real-time Comments
**Client → Server**
```javascript
socket.emit('new_comment', {
  challengeId: '64b1c2d3e4f5g6h7i8j9k0l1',
  content: 'Great point!'
});
```

**Server → All Clients in Room**
```javascript
socket.on('comment_added', (data) => {
  /*
  data = {
    id: '...',
    author: { id: '...', username: '...', avatar: '...' },
    content: 'Great point!',
    timestamp: '2024-11-20T18:30:00.000Z'
  }
  */
  addCommentToUI(data);
});
```

---

## 10.4 Viewer Count Updates
**Server → All Clients in Room** (automatic, every 5 seconds)
```javascript
socket.on('viewer_count_update', (data) => {
  /*
  data = {
    challengeId: '...',
    viewerCount: 250,
    peakViewers: 350
  }
  */
  updateViewerCount(data.viewerCount);
});
```

---

## 10.5 Advertisement Display
**Server → All Clients in Room**
```javascript
socket.on('ad_display', (data) => {
  /*
  data = {
    adId: '...',
    content: {
      type: 'video',
      url: '...'
    },
    duration: 30
  }
  */
  displayAdvertisement(data);
});
```

---

## 10.6 Advertisement Rejected
**Server → All Clients in Room**
```javascript
socket.on('ad_rejected', (data) => {
  /*
  data = {
    adId: '...',
    rejectedBy: 'john_doe',
    reason: 'Conflicts with principles'
  }
  */
  hideAdvertisement(data.adId);
  showRejectionMessage(data);
});
```

---

## 10.7 Challenge Status Change
**Server → All Clients in Room**
```javascript
socket.on('challenge_status_changed', (data) => {
  /*
  data = {
    challengeId: '...',
    status: 'live|completed|cancelled',
    message: 'Challenge has started!'
  }
  */
  updateChallengeStatus(data);
});
```

---

# 11. Error Response Format

All error responses follow this structure:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Specific field error"
    }
  }
}
```

## Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Authentication required or invalid |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource already exists |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `SERVER_ERROR` | 500 | Internal server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

---

# 12. Rate Limiting

**General API:**
- 100 requests per 15 minutes per IP

**Authentication endpoints:**
- 5 login attempts per 15 minutes per IP

**Comments/Ratings:**
- 50 requests per minute per user

**Headers in Response:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1700123456
```

---

# 13. Pagination Format

All paginated endpoints return:

```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

# 14. Testing Endpoints

## Health Check
**GET** `/health`

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-11-20T18:00:00.000Z",
  "uptime": 86400,
  "database": "connected",
  "redis": "connected"
}
```

---

**Document Version:** 1.0  
**Last Updated:** November 16, 2024  
**API Version:** v1  
**Base URL:** `https://api.dueli.platform/api/v1`