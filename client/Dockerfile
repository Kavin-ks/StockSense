FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Expose port (5173/5174 depending on env)
EXPOSE 5173
EXPOSE 5174

# Start development server
CMD ["npm", "run", "dev"]
