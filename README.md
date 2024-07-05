# Project README

## Monorepo for AI-based Frontend Component Generation

### Overview

This monorepo houses three interconnected projects aimed at creating an AI-based system for generating frontend components from Natspec specifications of custom smart contracts. The monorepo is divided into:

- **Backend (BE) & LLM Integration**
- **Frontend (FE) Viewer Application**
- **VS Code Plugin**

### Backend (BE) & LLM Integration

#### Summary
This project aims to interpret Natspec specifications of custom smart contracts and generate frontend components automatically using AI algorithms. The backend leverages natural language processing to extract insights from the specifications and predictive modeling to create effective frontend components.

#### Description
**Interpreting Natspec Specifications:**
- Implement a module to analyze Natspec specifications provided with custom smart contracts.
- Utilize natural language processing techniques to extract insights into the data structure and operations defined within the contract.
- Develop algorithms to parse and interpret the specifications accurately.

**Automatic Generation of Frontend Components:**
- Employ AI algorithms to automatically generate frontend components based on interpreted Natspec specifications.
- Design components that effectively query the data stored in the smart contracts.

**Key Components:**
- Predictive Modeling Techniques: Implement algorithms to analyze input data and generate predictions for React and Tailwind CSS components.
- Integration of Multiple Agents and Tools: Utilize libraries, frameworks, and APIs for machine learning, natural language processing, and design optimization.
- Optimization for Efficiency and Responsiveness: Minimize code complexity and ensure responsiveness for various screen sizes.
- Adherence to Design Best Practices: Incorporate best practices in layout, typography, color schemes, and accessibility.

### Frontend (FE) Viewer Application

#### Summary
Develop a viewer application for inspecting and editing AI-generated frontend components. The application will include visual preview, code editor with syntax highlighting and auto-completion, code export, and upload to IPFS functionality.

#### Description
**Key Features:**
- **Preview Functionality:** Display a visual preview of the AI-generated frontend components within the viewer application.
- **Code Editor:** Integrate a code editor with syntax highlighting, code formatting, and auto-completion features.
- **Code Export & Upload to IPFS:** Provide functionality for exporting edited code and uploading it to IPFS.
- **User Interface Design:** Design an intuitive and user-friendly interface, optimizing usability and accessibility.

**Implementation:**
- Inspect, preview, and edit AI-generated frontend components effectively.
- Support iterative development processes with AI to generate, update, or fix the code.

### VS Code Plugin

#### Summary
Create a dedicated Visual Studio Code (VS Code) plugin to integrate AI-based frontend generation functionality, streamline interaction, facilitate iterative design processes, provide user-friendly interfaces, and ensure compatibility with standard workflows.

#### Description
**Plugin Features:**
- Integration of AI-based frontend generation functionality directly into the VS Code environment.
- Seamless access to frontend generation tools and features within the VS Code interface.
- Facilitation of iterative design processes for fine-tuning UI components.
- Implementation of user-friendly interfaces and commands for easy navigation.
- Compatibility with standard VS Code workflows to maximize productivity.
- Provision of documentation and tutorials to guide developers.
- Continuous updates and support for the latest VS Code versions and frontend generation enhancements.

### Repository Structure

```
/monorepo
├── /backend
│   ├── /natspec_interpreter
│   ├── /frontend_generator
│   └── ...
├── /frontend
│   ├── /viewer_application
│   └── ...
├── /vscode_plugin
│   ├── /plugin_code
│   └── ...
└── README.md
```

### Setup and Installation

1. **Clone the Repository:**
   ```
   git clone https://github.com/Ethereans-Labs/monorepo.git
   ```

2. **Navigate to Each Project Directory and Install Dependencies:**
   ```
   cd backend/natspec_interpreter
   npm install
   cd ../frontend_generator
   npm install
   cd ../../frontend/viewer_application
   npm install
   cd ../../vscode_plugin/plugin_code
   npm install
   ```

### Running the Projects

1. **Backend:**
   ```
   cd backend/natspec_interpreter
   npm start
   cd ../frontend_generator
   npm start
   ```

2. **Frontend Viewer Application:**
   ```
   cd frontend/viewer_application
   npm start
   ```

3. **VS Code Plugin:**
   - Follow the VS Code extension development guide to load and test the plugin.


### Contact

For any questions or issues, please open an issue on GitHub.
