import Button from "@/components/button/button";
import styles from "./page.module.css";
import Link from "next/link";

export default function ServicesOverview() {
  return (
    <main className={styles.main}>
      <div className={styles.docWrapper}>
        <h1>Services Comprehensive Overview</h1>
        <p>
          Imagine a bustling digital marketplace where every piece of idle compute power is transformed into a vibrant service—this is the heart of Cxmpute. Today, we’re taking you on a tour of our extensive suite of services that power everything from scalable virtual machines to dynamic AI chatbots. Each service is designed with the modern user in mind, whether you’re a developer, a data scientist, or an enterprise looking for innovative solutions.
        </p>
        <h2>Compute Power, Reimagined</h2>
        <h3>Virtual Machines</h3>
        <p>
          Our Virtual Machines provide a customizable, scalable compute environment, perfect for running a variety of workloads. Think of them as your personal mini data centers, optimized for specific hardware configurations and designed to deliver efficient, cost-effective performance across our decentralized network.
        </p>
        <h3>Serverless</h3>
        <p>
          With Cxmpute’s Serverless service, you can deploy applications in an event-driven manner—no need to worry about managing traditional servers. This solution scales effortlessly to meet demand, giving you more time to focus on creating amazing products.
        </p>
        <h3>Kubernetes</h3>
        <p>
          For those managing containerized applications, our Kubernetes support brings the power of large-scale container orchestration to your fingertips. It enables decentralized AI training and serverless deployments, ensuring that your applications run smoothly and flexibly across the network.
        </p>
        <h2>Empowering AI and Intelligent Workflows</h2>
        <h3>AI Agents</h3>
        <p>
          Our AI Agents are modular and intelligent—ready to tackle tasks ranging from simple automation to orchestrating complex workflows. With our Agxnt service, integrating these agents into your applications is seamless, boosting both productivity and creativity.
        </p>
        <h3>AI Inference</h3>
        <p>
          Deploy AI models without the hassle of managing infrastructure. Cxmpute’s AI Inference service provides a serverless solution for rapid, cost-efficient model execution, making it easier than ever to harness the power of AI.
        </p>
        <h3>AI Fine-tuning</h3>
        <p>
          Tailor pre-trained models to your specific needs with our AI Fine-tuning service. By decentralizing the process, you can enhance model accuracy affordably—no need for massive centralized data centers.
        </p>
        <h3>AI Training</h3>
        <p>
          When it comes to training large-scale machine learning models, our decentralized infrastructure offers a flexible, cost-efficient solution. Tap into distributed compute power to accelerate your AI training workloads.
        </p>
        <h3>Workflows</h3>
        <p>
          Streamline your processes by automating tasks that span multiple compute services. Cxmpute’s Workflows bring together various features into a cohesive system, ensuring flexibility, reliability, and scalability.
        </p>
        <h2>Revolutionizing Data and Development</h2>
        <h3>Storage &amp; Databases</h3>
        <p>
          Our storage solutions, known as Stxrage, offer decentralized, secure file storage—ideal for ensuring data integrity and avoiding single points of failure. Complementing this is our suite of database services:
        </p>
        <ul>
          <li>
            <strong>Vector Database:</strong> Optimize your AI-driven applications with efficient search and retrieval of high-dimensional data.
          </li>
          <li>
            <strong>Databases:</strong> Store and query structured data in a resilient, censorship-resistant environment.
          </li>
          <li>
            <strong>Datasets:</strong> A collaborative platform to share and store datasets, fostering open innovation and research.
          </li>
        </ul>
        <h3>Developer Tools: Code Spaces and PyNotebooks</h3>
        <p>
          Developers, rejoice! Our Code Spaces provide a cloud-based environment for coding, testing, and deploying applications with ease. Meanwhile, PyNotebooks offer an interactive, Python-driven workspace—ideal for data science and machine learning workflows that benefit from decentralized compute power.
        </p>
        <h2>Creativity Meets Technology</h2>
        <h3>Rendering</h3>
        <p>
          For the digital creators and designers among us, Cxmpute’s Rendering service brings decentralized 3D rendering capabilities to your projects. Whether you’re creating virtual worlds or simulations, enjoy faster rendering times and reduced costs by tapping into distributed compute resources.
        </p>
        <h3>AI Chat</h3>
        <p>
          And let’s not forget AI Chat—a service that integrates intelligent, conversational agents into your applications for real-time, interactive communication. This is where automation meets a human touch, elevating user engagement to new heights.
        </p>
        <p>
          Cxmpute’s comprehensive suite of services is designed to empower every user in our ecosystem. By transforming idle compute resources into powerful, scalable, and cost-effective solutions, we’re not just building a platform—we’re redefining the future of decentralized computing. Ready to explore the possibilities? Join us and harness the full potential of the Cxmpute network.
        </p>
        <Link href="/">
          <Button text="Back to Home" backgroundColor="#20a191" />
        </Link>
      </div>
    </main>
  );
}
