-- Create Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(30) NOT NULL CHECK (char_length(name) >= 3),
  email VARCHAR(255) NOT NULL UNIQUE,
  phone BIGINT NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('Job Seeker', 'Employer')),
  favourite_sport VARCHAR(30) NOT NULL CHECK (char_length(favourite_sport) >= 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Jobs Table
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(30) NOT NULL CHECK (char_length(title) >= 3),
  description VARCHAR(500) NOT NULL CHECK (char_length(description) >= 30),
  category VARCHAR(100) NOT NULL,
  country VARCHAR(100) NOT NULL,
  city VARCHAR(100) NOT NULL,
  location VARCHAR(255) NOT NULL CHECK (char_length(location) >= 20),
  fixed_salary INTEGER CHECK (fixed_salary >= 1000 AND fixed_salary <= 999999999),
  salary_from INTEGER CHECK (salary_from >= 1000 AND salary_from <= 999999999),
  salary_to INTEGER CHECK (salary_to >= 1000 AND salary_to <= 999999999),
  expired BOOLEAN DEFAULT FALSE,
  job_posted_on TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  posted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

-- Create Applications Table
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(30) NOT NULL CHECK (char_length(name) >= 3),
  email VARCHAR(255) NOT NULL,
  cover_letter TEXT NOT NULL,
  phone BIGINT NOT NULL,
  address TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  resume_public_id VARCHAR(255) NOT NULL,
  resume_url TEXT NOT NULL,
  applicant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  applicant_role VARCHAR(20) DEFAULT 'Job Seeker' CHECK (applicant_role = 'Job Seeker'),
  employer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  employer_role VARCHAR(20) DEFAULT 'Employer' CHECK (employer_role = 'Employer'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_jobs_posted_by ON jobs(posted_by);
CREATE INDEX IF NOT EXISTS idx_jobs_expired ON jobs(expired);
CREATE INDEX IF NOT EXISTS idx_applications_applicant ON applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_applications_employer ON applications(employer_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- RLS Policies (These allow service role to bypass RLS)
-- For production, you may want more granular policies
CREATE POLICY "Enable all access for service role" ON users FOR ALL USING (true);
CREATE POLICY "Enable all access for service role" ON jobs FOR ALL USING (true);
CREATE POLICY "Enable all access for service role" ON applications FOR ALL USING (true);
