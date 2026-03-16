FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy all source code
COPY . .

# Expose port your dev server uses
EXPOSE 3000

# Run dev server
CMD ["npm", "run", "dev"]